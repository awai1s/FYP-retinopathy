"""Phase 10O regression tests. Only synthetic records in a dedicated database.
Run: .venv/Scripts/python -m pytest tests -q
Set PHASE10O_REAL_MONGO=1 to use Atlas instead of the in-memory test double.
Outbound OTP and notification email are captured, never sent to demo addresses.
"""
import os
os.environ["DATABASE_NAME"] = "dr_healthcare_phase10o_test"
import io
import json
import uuid
from urllib.parse import unquote
from datetime import datetime, timedelta
from pathlib import Path
import bcrypt
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from PIL import Image
import config
import database
import main
from routers import superadmin
from verification_service import DOCTOR_REQUIRED_DOCUMENTS, HOSPITAL_REQUIRED_DOCUMENTS

PASSWORD = "Demo10O!2026"
RUN = uuid.uuid4().hex[:8]
OUT = Path(__file__).parent / "last_demo_run.json"

@pytest.fixture(scope="session")
def env():
    mailbox = {}
    main.send_otp_email = lambda email, otp: mailbox.update({email: otp})
    superadmin.send_account_notification_email = lambda *args, **kwargs: None
    if os.getenv("PHASE10O_REAL_MONGO") != "1":
        import mongomock
        import mongomock.gridfs
        mongomock.gridfs.enable_gridfs_integration()
        database.client = mongomock.MongoClient()
        database.db = database.client[config.DATABASE_NAME]
        main.init_db = lambda: database._setup_indexes(database.db) or database.db
    assert config.DATABASE_NAME == "dr_healthcare_phase10o_test"
    with TestClient(main.app, raise_server_exceptions=False) as client:
        db = database.get_db()
        admin_email = f"phase10o.admin.{RUN}@example.com"
        admin_id = str(db.users.insert_one({
            "name":"DEMO Phase10O Admin", "email":admin_email, "role":"SuperAdmin",
            "password":bcrypt.hashpw(PASSWORD.encode(),bcrypt.gensalt()).decode(),
            "accountStatus":"active", "is_verified":True,
        }).inserted_id)
        e = {"client":client, "db":db, "mailbox":mailbox, "accounts":{}}
        e["accounts"]["admin"] = login(e, admin_email, admin_id)
        yield e
        if os.getenv("PHASE10O_REAL_MONGO") == "1":
            OUT.write_text(json.dumps({"database":config.DATABASE_NAME,"run":RUN,"password":PASSWORD,
                "accounts":{k:{x:v[x] for x in ("email","id")} for k,v in e["accounts"].items()}},indent=2))

def req(e,method,path,actor=None,code=200,**kwargs):
    headers = kwargs.pop("headers",{})
    if actor:headers["Authorization"]="Bearer "+e["accounts"][actor]["token"]
    r=e["client"].request(method,path,headers=headers,**kwargs)
    assert r.status_code==code,(method,path,r.status_code,r.text[:1200])
    return r.json() if "json" in r.headers.get("content-type","") else r.content

def login(e,email,uid):
    data=req(e,"POST","/login",json={"email":email,"password":PASSWORD})
    return {"id":uid,"email":email,"token":data["access_token"]}


def test_local_private_network_preflight(env):
    response = env["client"].options(
        "/api/credentials-privileges/hospital/doctors",
        headers={
            "Origin": "http://localhost:8082",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-private-network"] == "true"
    assert response.headers["access-control-allow-origin"] == "*"

def signup(e,key,role):
    email=f"phase10o.{key}.{RUN}@example.com"
    req(e,"POST","/send-otp",json={"email":email})
    otp=e["mailbox"][email]
    req(e,"POST","/verify-otp",json={"email":email,"otp":otp})
    req(e,"POST","/signup",json={"email":email,"password":PASSWORD,"name":"DEMO "+key,
        "username":f"demo_{key}_{RUN}","role":role,"mobile":"03000000000","age":30})
    user=e["db"].users.find_one({"email":email})
    e["accounts"][key]=login(e,email,str(user["_id"]))
    return str(user["_id"])

def approve(e,key,role):
    doctor={"fullName":"DEMO Doctor","medicalLicenseNumber":"DEMO-"+RUN+key,
        "licensingAuthority":"DEMO authority","specialization":"Ophthalmology",
        "qualification":"DEMO qualification","yearsOfExperience":2,
        "licenseIssueDate":"2025-01-01","licenseExpiryDate":"2030-01-01",
        "phone":"03000000000","address":"DEMO test facility"}
    hospital={"hospitalName":"DEMO Hospital","registrationNumber":"DEMO-"+RUN,
        "facilityType":"Eye Hospital","address":"DEMO test facility","city":"Lahore",
        "officialEmail":e["accounts"][key]["email"],"phone":"03000000000",
        "responsibleContactPerson":"DEMO Contact","registrationAuthority":"DEMO authority"}
    req(e,"PUT","/api/provider-verification/details",key,json=doctor if role=="Doctor" else hospital)
    for kind in DOCTOR_REQUIRED_DOCUMENTS if role=="Doctor" else HOSPITAL_REQUIRED_DOCUMENTS:
        req(e,"POST","/api/provider-verification/documents/"+kind,key,
            files={"file":("DEMO-verification.pdf",b"%PDF-1.4\n% DEMO TEST DOCUMENT\n%%EOF","application/pdf")})
    data=req(e,"POST","/api/provider-verification/submit",key)
    status=req(e,"GET","/api/provider-verification/status",key)
    vid=status["id"]
    req(e,"POST",f"/api/superadmin/verifications/{vid}/decision","admin",
        json={"decision":"verify","reason":"Synthetic integration test approval"})
    e[key+"_verification"]=vid

@pytest.fixture(scope="session")
def care(env):
    e=env
    p=signup(e,"patient","Patient")
    d=signup(e,"doctor","Doctor")
    signup(e,"outsider","Doctor")
    signup(e,"hospital","Hospital")
    # Pending provider is denied even with a known patient ID.
    req(e,"GET",f"/api/patients/{p}","doctor",code=403)
    approve(e,"doctor","Doctor")
    approve(e,"outsider","Doctor")
    approve(e,"hospital","Hospital")
    req(e,"GET",f"/api/patients/{p}","doctor",code=403)
    connection=req(e,"POST","/api/connections/request","patient",code=201,json={"targetId":d})
    cid=connection.get("id") or connection.get("connection",{}).get("id")
    assert cid,connection
    req(e,"PATCH",f"/api/connections/{cid}/accept","doctor")
    e["connection"]=cid
    yield e

def test_signup_and_access(care):
    e=care
    p=e["accounts"]["patient"]["id"]
    req(e,"GET","/api/patient/profile","patient")
    req(e,"GET",f"/api/patients/{p}","doctor")
    req(e,"GET",f"/api/patients/{p}","outsider",code=403)
    req(e,"GET","/api/superadmin/dashboard","patient",code=403)

def test_vault_preserves_contact_and_glasses_history(care):
    e=care
    path="/api/patient/vision-prescriptions"
    a=req(e,"POST",path,"patient",code=201,json={"type":"contact_lens","issuedDate":"2026-09-20","rightPower":-1.5,"leftPower":-2,"brand":"DEMO First"})
    b=req(e,"POST",path,"patient",code=201,json={"type":"contact_lens","issuedDate":"2026-09-24","rightPower":-2.5,"leftPower":-3,"brand":"DEMO Updated"})
    g=req(e,"POST",path,"patient",code=201,json={"type":"glasses","issuedDate":"2026-09-24","rightSph":-1})
    vault=req(e,"GET",path,"patient")
    assert vault["currentContactLens"]["id"]==b["id"]
    assert vault["currentContactLens"]["contactLens"]["rightPower"]==-2.5
    assert vault["currentGlasses"]["id"]==g["id"]
    assert a["id"] in [x["id"] for x in vault["history"]]
    req(e,"GET",path+"/"+b["id"],"doctor",code=403)
    req(e,"POST",path,"patient",code=400,json={"type":"glasses","issuedDate":"2026-02-31"})
    req(e,"POST",path,"patient",code=422,json={"type":"contact_lens","issuedDate":"2026-09-24","baseCurve":50})

def test_consultation_to_medication_education_and_history(care):
    e=care
    ap=req(e,"POST","/api/appointments","patient",code=201,json={"doctorId":e["accounts"]["doctor"]["id"],
        "date":(datetime.utcnow()+timedelta(days=1)).strftime("%Y-%m-%d"),"time":"10:00 AM","reason":"DEMO follow-up"})
    req(e,"PATCH",f"/api/appointments/{ap['id']}/status","doctor",json={"status":"Confirmed"})
    enc=req(e,"POST",f"/api/consultations/from-appointment/{ap['id']}","doctor")
    eid=enc.get("id") or enc.get("encounter",{}).get("id")
    assert eid,enc
    e["encounter"]=eid
    action={"actionId":"demo-start-"+RUN,"action":"started","medication":{
        "medicationDetails":"DEMO medication","dosage":"DEMO dose","times":["Morning"],"instructions":"Test only"}}
    rec=req(e,"POST",f"/api/medication-reconciliations/encounter/{eid}/actions","doctor",json=action)
    req(e,"POST",f"/api/medication-reconciliations/encounter/{eid}/actions","doctor",json=action)
    req(e,"POST",f"/api/medication-reconciliations/encounter/{eid}/complete","doctor",json={"notes":"Demo reviewed"})
    options=req(e,"GET","/api/consultations/education-options","doctor")
    topics=options.get("topics") or options.get("options") or options.get("education") or options
    topic=topics[0]["key"]
    req(e,"PATCH",f"/api/consultations/{eid}","doctor",json={
        "clinicalNotes":"DEMO private note", "patientInstructions":"DEMO instructions",
        "educationTopicKeys":[topic],"nextAction":{"type":"none","details":"Demo visit complete"}})
    req(e,"POST",f"/api/consultations/{eid}/complete","doctor")
    summary=req(e,"GET",f"/api/consultations/{eid}","patient")
    assert "DEMO private note" not in json.dumps(summary)
    req(e,"GET","/api/patient/education/assignments","patient")
    meds=req(e,"GET","/api/patient/prescriptions","patient")
    assert "DEMO medication" in json.dumps(meds)
    prescription=e["db"].prescriptions.find_one({"patientId":e["accounts"]["patient"]["id"]})
    assert prescription,meds
    adherence_path=f"/api/patient/prescriptions/{prescription['_id']}/adherence"
    scheduled=datetime.utcnow().strftime("%Y-%m-%d")
    a={"status":"Taken","scheduledDate":scheduled,"clientOperationId":"demo-dose-A-"+RUN}
    b={"status":"Skipped","scheduledDate":scheduled,"clientOperationId":"demo-dose-B-"+RUN}
    req(e,"POST",adherence_path,"patient",json=a)
    req(e,"POST",adherence_path,"patient",json=b)
    replay=req(e,"POST",adherence_path,"patient",json=a)
    assert replay["idempotentReplay"] and replay["adherence"]["status"]=="Skipped",replay
    req(e,"GET","/api/patient/history","patient")
    logs=req(e,"GET","/api/patient/privacy/access-logs","patient")
    assert len(logs.get("events",logs.get("logs",[])))>0,logs
    req(e,"PATCH",f"/api/consultations/{eid}","doctor",code=409,json={"clinicalNotes":"Must not change"})

def test_health_card_scopes_and_revocation(care):
    e=care
    req(e,"GET","/api/patient/privacy/health-card","patient")
    req(e,"PATCH","/api/patient/privacy/health-card/settings","patient",json={
        "basicIdentity":True,"allergies":False,"activeMedication":False,"latestHba1c":False,"latestDrResult":False})
    share=req(e,"POST","/api/patient/privacy/health-card/emergency-qr","patient",json={"rotate":True})
    e["qr_response"]=share
    # The public URL intentionally carries only the opaque sharing token.
    url=share["share"].get("shareUrl")
    assert url,share
    token=unquote(url.split("/health-card/q/",1)[1])
    public=req(e,"GET",f"/api/public/health-card/{token}")
    assert "profile" in public["data"],public
    assert "allergies" not in public["data"] and "activeMedications" not in public["data"]
    req(e,"PATCH",f"/api/patient/privacy/health-card/shares/{share['share']['id']}/revoke",
        "patient",json={"reason":"DEMO test revocation"})
    req(e,"GET",f"/api/public/health-card/{token}",code=410)
    limited=req(e,"POST","/api/patient/privacy/health-card/temporary-qr","patient",code=201,
        json={"scopes":["profile.basic"],"durationMinutes":15,"maxUses":1})
    limited_token=unquote(limited["share"]["shareUrl"].split("/health-card/q/",1)[1])
    req(e,"GET",f"/api/public/health-card/{limited_token}")
    req(e,"GET",f"/api/public/health-card/{limited_token}",code=410)

def test_screening_messages_and_role_integrations(care):
    e=care
    patient=e["accounts"]["patient"]["id"]
    req(e,"POST","/api/vision-tests","patient",code=201,
        json={"testType":"DEMO visual acuity","score":80,"result":"DEMO result","durationSeconds":20})
    tests=req(e,"GET","/api/vision-tests","patient")
    assert any(x["testType"]=="DEMO visual acuity" for x in tests["tests"])
    assert req(e,"GET","/api/gamification","patient")["completedTests"]>=1
    image=Image.new("RGB",(300,300),"white")
    stream=io.BytesIO();image.save(stream,format="PNG")
    quality=req(e,"POST","/api/patient/image-quality","patient",
        files={"file":("DEMO-retina.png",stream.getvalue(),"image/png")})
    assert quality["accepted"] is True
    req(e,"POST","/api/patient/image-quality","patient",code=400,
        files={"file":("fake.png",b"not an image","image/png")})
    req(e,"GET",f"/api/clinical/patients/{patient}/retinal-images","doctor")
    req(e,"GET",f"/api/clinical/patients/{patient}/retinal-images","outsider",code=403)
    req(e,"GET","/api/doctor/alerts","doctor")
    req(e,"POST","/api/doctor/notes","doctor",code=201,
        json={"patientId":patient,"content":"DEMO clinical note"})
    req(e,"POST","/api/doctor/notes","outsider",code=403,
        json={"patientId":patient,"content":"Must not be saved"})
    due=(datetime.utcnow()+timedelta(days=3)).strftime("%Y-%m-%d")
    for number in range(2):
        req(e,"POST","/api/doctor/follow-ups","doctor",code=201,
            json={"patientId":patient,"dueDate":due,"reason":f"DEMO follow-up {number}"})
    cid=e["connection"]
    req(e,"GET","/messages/conversations","patient")
    req(e,"GET",f"/messages/conversations/{cid}","doctor")
    req(e,"POST",f"/messages/conversations/{cid}","patient",
        json={"message":"DEMO care message"})
    messages=req(e,"GET",f"/messages/conversations/{cid}","doctor")
    assert any(m["message"]=="DEMO care message" for m in messages["messages"])
    req(e,"POST",f"/messages/conversations/{cid}/read","doctor")
    req(e,"GET",f"/messages/conversations/{cid}/references","doctor")
    req(e,"GET",f"/messages/conversations/{cid}","outsider",code=404)
    req(e,"GET","/api/hospital/patients","hospital")
    req(e,"GET","/api/hospital/doctors","hospital")
    req(e,"GET","/api/hospital/statistics","hospital")
    req(e,"GET","/api/hospital/activity","hospital")
