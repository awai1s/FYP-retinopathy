"""Existing screen integrations using the canonical clinical collections."""
from __future__ import annotations
import io
import re
from datetime import date, datetime
from typing import Any, Literal
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from access_control import require_patient_access, list_authorized_patient_ids, record_clinical_access, require_verified_provider
from connection_service import require_accepted_connection
from database import get_db
from dependencies import RoleChecker, VerifiedProviderChecker, get_current_user
from storage import get_file_from_gridfs, MAX_SIZE

router = APIRouter(tags=["Clinical integrations"])
patient_only = [Depends(RoleChecker(["Patient"]))]
doctor_only = [Depends(RoleChecker(["Doctor"])), Depends(VerifiedProviderChecker())]
hospital_only = [Depends(RoleChecker(["Hospital"])), Depends(VerifiedProviderChecker())]

def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(400, "Invalid record ID")
    return ObjectId(value)

def serial(value: Any):
    if isinstance(value, dict):
        return {("id" if k == "_id" else k): serial(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [serial(v) for v in value]
    if isinstance(value, ObjectId): return str(value)
    if isinstance(value, (datetime, date)): return value.isoformat()
    return value

def access(user, patient_id, scope, action, resource="patient", resource_id=None):
    db=get_db()
    decision=require_patient_access(user, patient_id, scope, db)
    if user["role"] != "Patient":
        record_clinical_access(current_user=user,patient_id=patient_id,action=action,
            resource_type=resource,resource_id=resource_id or patient_id,
            access_channel=decision.access_channel,scope=scope,reason=decision.reason,db=db)
    return db

class VisionResult(BaseModel):
    testType: str = Field(min_length=1, max_length=80)
    score: float | None = Field(default=None, ge=0, le=100)
    result: str = Field(default="", max_length=500)
    durationSeconds: float | None = Field(default=None, ge=0, le=86400)
    metadata: dict = Field(default_factory=dict)

@router.post("/api/vision-tests",dependencies=patient_only,status_code=201)
def save_vision_test(payload: VisionResult,user:dict=Depends(get_current_user)):
    db=get_db()
    now=datetime.utcnow()
    doc={**payload.model_dump(),"patientId":user["_id"],"createdAt":now,"date":now.strftime("%Y-%m-%d")}
    doc["_id"]=db.vision_tests.insert_one(doc).inserted_id
    db.patient_history.insert_one({"patientId":user["_id"],"sourceId":str(doc["_id"]),
        "type":"Vision Test","title":payload.testType,"result":payload.result,
        "date":doc["date"],"status":"Completed","created_at":now})
    return {"message":"Vision test saved","test":serial(doc),"id":str(doc["_id"])}

@router.get("/api/vision-tests",dependencies=patient_only)
def vision_tests(user:dict=Depends(get_current_user)):
    return {"tests":serial(list(get_db().vision_tests.find({"patientId":user["_id"]}).sort("createdAt",-1).limit(200)))}

@router.get("/api/gamification",dependencies=patient_only)
def gamification(user:dict=Depends(get_current_user)):
    count=get_db().vision_tests.count_documents({"patientId":user["_id"]})
    return {"completedTests":count,"points":count*10,"badges":["First vision test"] if count else []}

@router.post("/api/patient/image-quality",dependencies=patient_only)
def image_quality(file:UploadFile=File(...),user:dict=Depends(get_current_user)):
    data=file.file.read(MAX_SIZE+1)
    if len(data)>MAX_SIZE:raise HTTPException(413,"Image exceeds the upload size limit")
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format not in {"JPEG","PNG"}:raise HTTPException(400,"Use a JPEG or PNG image")
            width,height=im.size
            if width*height>25_000_000:raise HTTPException(400,"Image resolution is too large")
            im.verify()
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError):
        raise HTTPException(400,"The file is not a readable image")
    accepted=min(width,height)>=256
    return {"accepted":accepted,"width":width,"height":height,
        "message":"Image is ready to upload." if accepted else "Choose an image at least 256 pixels wide and high."}

@router.get("/api/clinical/patients/{patient_id}/retinal-images")
def retinal_images(patient_id:str,user:dict=Depends(get_current_user)):
    db=access(user,patient_id,"screening.image.read","VIEW_RETINAL_IMAGES","retinal_image")
    docs=db.predictions.find({"patientId":patient_id,"fileId":{"$exists":True}}).sort("created_at",-1).limit(100)
    return {"images":[{"id":str(x["_id"]),"fileId":str(x["fileId"]),
        "fileName":x.get("fileName","Retinal image"),"contentType":x.get("contentType","image/jpeg"),
        "createdAt":serial(x.get("created_at")),"url":f"/api/clinical/patients/{patient_id}/retinal-images/{x['_id']}/download"} for x in docs]}

@router.get("/api/clinical/patients/{patient_id}/retinal-images/{prediction_id}/download")
def retinal_download(patient_id:str,prediction_id:str,user:dict=Depends(get_current_user)):
    db=access(user,patient_id,"screening.image.read","VIEW_RETINAL_IMAGE","prediction",prediction_id)
    doc=db.predictions.find_one({"_id":oid(prediction_id),"patientId":patient_id})
    if not doc or not doc.get("fileId"):raise HTTPException(404,"Retinal image not found")
    stream,_,mime=get_file_from_gridfs(str(doc["fileId"]))
    return StreamingResponse(io.BytesIO(stream.read()),media_type=mime,
        headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"})

class DoctorNote(BaseModel):
    patientId:str
    content:str=Field(min_length=1,max_length=10000)
    predictionId:str|None=None
class FollowUp(BaseModel):
    patientId:str
    dueDate:date
    reason:str=Field(min_length=1,max_length=2000)

@router.get("/api/doctor/alerts",dependencies=doctor_only)
def doctor_alerts(user:dict=Depends(get_current_user)):
    db=get_db(); ids=list(list_authorized_patient_ids(user,db))
    docs=db.predictions.find({"patientId":{"$in":ids},"status":"Completed","$or":[
        {"riskScore":{"$gte":70}},{"stage":{"$in":["Severe","Severe DR","Proliferative DR"]}}]}).sort("created_at",-1).limit(100)
    return {"alerts":serial(list(docs))}

@router.post("/api/doctor/notes",dependencies=doctor_only,status_code=201)
def doctor_note(payload:DoctorNote,user:dict=Depends(get_current_user)):
    db=access(user,payload.patientId,"consultation.write","CREATE_CLINICAL_NOTE","clinical_note")
    if not payload.content.strip():raise HTTPException(400,"Enter a clinical note")
    if payload.predictionId and not db.predictions.find_one({"_id":oid(payload.predictionId),"patientId":payload.patientId}):
        raise HTTPException(404,"Patient prediction not found")
    doc={**payload.model_dump(),"content":payload.content.strip(),"doctorId":user["_id"],"createdAt":datetime.utcnow()}
    doc["_id"]=db.doctor_notes.insert_one(doc).inserted_id
    return serial(doc)

@router.post("/api/doctor/follow-ups",dependencies=doctor_only,status_code=201)
def doctor_follow_up(payload:FollowUp,user:dict=Depends(get_current_user)):
    db=access(user,payload.patientId,"consultation.write","CREATE_FOLLOW_UP","clinical_follow_up")
    if payload.dueDate<datetime.utcnow().date():raise HTTPException(400,"Follow-up date cannot be in the past")
    now=datetime.utcnow()
    doc={"patientId":payload.patientId,"doctorId":user["_id"],"dueDate":payload.dueDate.isoformat(),
        "reason":payload.reason.strip(),"status":"pending","createdAt":now,"updatedAt":now}
    doc["_id"]=db.clinical_follow_ups.insert_one(doc).inserted_id
    db.notifications.insert_one({"userId":payload.patientId,"type":"follow_up","title":"Follow-up planned",
        "message":f"A follow-up is planned for {doc['dueDate']}.","read":False,"relatedId":str(doc["_id"]),"createdAt":now})
    return serial(doc)

def hospital_patients_list(user,query=""):
    db=get_db();ids=list(list_authorized_patient_ids(user,db))
    q={"_id":{"$in":[oid(x) for x in ids if ObjectId.is_valid(x)]},"role":"Patient"}
    if query:q["$or"]=[{f:{"$regex":re.escape(query),"$options":"i"}} for f in ["name","username","email"]]
    return list(db.users.find(q,{"name":1,"username":1,"email":1,"mobile":1}).limit(200))

@router.get("/api/hospital/patients",dependencies=hospital_only)
def hospital_patients(query:str=Query("",max_length=120),user:dict=Depends(get_current_user)):
    return {"patients":serial(hospital_patients_list(user,query))}

@router.get("/api/hospital/doctors",dependencies=hospital_only)
def hospital_doctors(query:str=Query("",max_length=120),user:dict=Depends(get_current_user)):
    db=get_db()
    ids=[x["doctorId"] for x in db.hospital_doctor_affiliations.find({"hospitalId":user["_id"],"status":"active"})]
    q={"_id":{"$in":[oid(x) for x in ids if ObjectId.is_valid(x)]},"role":"Doctor"}
    if query:q["name"]={"$regex":re.escape(query),"$options":"i"}
    return {"doctors":serial(list(db.users.find(q,{"name":1,"email":1,"username":1}).limit(200)))}

@router.get("/api/hospital/statistics",dependencies=hospital_only)
def hospital_statistics(user:dict=Depends(get_current_user)):
    db=get_db();hid=user["_id"]
    return {"patients":len(hospital_patients_list(user)),
        "doctors":db.hospital_doctor_affiliations.count_documents({"hospitalId":hid,"status":"active"}),
        "reports":db.reports.count_documents({"hospitalId":hid}),
        "equipment":db.eye_equipment.count_documents({"hospitalId":hid})}

@router.get("/api/hospital/activity",dependencies=hospital_only)
def hospital_activity(user:dict=Depends(get_current_user)):
    return {"activity":serial(list(get_db().reports.find({"hospitalId":user["_id"]},
        {"fileName":1,"createdAt":1,"status":1}).sort("_id",-1).limit(30)))}

def conversation(user,connection_id):
    db=get_db()
    doc=db.care_connections.find_one({"_id":oid(connection_id)})
    if not doc or user["_id"] not in [str(doc.get("patientId")),str(doc.get("doctorId"))]:
        raise HTTPException(404,"Conversation not found")
    pid,did=str(doc["patientId"]),str(doc["doctorId"])
    doctor=db.users.find_one({"_id":oid(did)})
    if not doctor:raise HTTPException(404,"Doctor not found")
    require_verified_provider(doctor,db)
    require_accepted_connection(db,pid,did)
    access(user,pid,"profile.clinical.read","VIEW_CONVERSATION","conversation",connection_id)
    other=did if user["_id"]==pid else pid
    person=db.users.find_one({"_id":oid(other)},{"name":1,"role":1}) or {}
    return doc,{"id":other,"name":person.get("name","Care team"),"role":person.get("role","Patient")}

message_roles=[Depends(RoleChecker(["Patient","Doctor"]))]

@router.get("/messages/conversations",dependencies=message_roles)
def conversations(user:dict=Depends(get_current_user)):
    db=get_db()
    if user["role"]=="Doctor":require_verified_provider(user,db)
    key="patientId" if user["role"]=="Patient" else "doctorId"
    result=[]
    for con in db.care_connections.find({key:user["_id"],"status":"accepted"}).limit(100):
        cid=str(con["_id"])
        try:_,person=conversation(user,cid)
        except HTTPException:continue
        last=db.messages.find_one({"conversationId":cid},sort=[("createdAt",-1)])
        result.append({"conversationId":cid,"person":person,"lastMessage":(last or {}).get("message"),
            "lastMessageAt":serial((last or {}).get("createdAt")),
            "unreadCount":db.messages.count_documents({"conversationId":cid,"senderId":{"$ne":user["_id"]},"readBy":{"$ne":user["_id"]}})})
    return {"conversations":result}

@router.get("/messages/conversations/{conversation_id}",dependencies=message_roles)
def get_messages(conversation_id:str,user:dict=Depends(get_current_user)):
    _,person=conversation(user,conversation_id)
    docs=list(get_db().messages.find({"conversationId":conversation_id}).sort("createdAt",-1).limit(200))
    return {"person":person,"messages":serial(list(reversed(docs)))}

class MessageInput(BaseModel):
    message:str=Field(min_length=1,max_length=5000)
class ReferenceInput(BaseModel):
    referenceId:str

def put_message(user,cid,text,**extra):
    doc={"conversationId":cid,"senderId":user["_id"],"message":text,"messageType":"text",
        "createdAt":datetime.utcnow(),"readBy":[user["_id"]],**extra}
    doc["_id"]=get_db().messages.insert_one(doc).inserted_id
    return serial(doc)

@router.post("/messages/conversations/{conversation_id}",dependencies=message_roles)
def send_message(conversation_id:str,payload:MessageInput,user:dict=Depends(get_current_user)):
    conversation(user,conversation_id)
    if not payload.message.strip():raise HTTPException(400,"Enter a message")
    return put_message(user,conversation_id,payload.message.strip())

@router.post("/messages/conversations/{conversation_id}/read",dependencies=message_roles)
def read_messages(conversation_id:str,user:dict=Depends(get_current_user)):
    conversation(user,conversation_id)
    get_db().messages.update_many({"conversationId":conversation_id},{"$addToSet":{"readBy":user["_id"]}})
    return {"message":"Conversation marked read"}

@router.get("/messages/conversations/{conversation_id}/references",dependencies=message_roles)
def message_references(conversation_id:str,user:dict=Depends(get_current_user)):
    con,_=conversation(user,conversation_id)
    db=access(user,str(con["patientId"]),"reports.read","VIEW_REPORT_REFERENCES","conversation",conversation_id)
    docs=db.reports.find({"patientId":str(con["patientId"])}).sort("_id",-1).limit(100)
    return {"references":[{"id":str(x["_id"]),"title":x.get("reportType") or x.get("fileName","Report"),
        "description":x.get("description","")} for x in docs]}

@router.post("/messages/conversations/{conversation_id}/references",dependencies=message_roles)
def send_reference(conversation_id:str,payload:ReferenceInput,user:dict=Depends(get_current_user)):
    con,_=conversation(user,conversation_id)
    db=access(user,str(con["patientId"]),"reports.read","SHARE_REPORT_REFERENCE","report",payload.referenceId)
    report=db.reports.find_one({"_id":oid(payload.referenceId),"patientId":str(con["patientId"])})
    if not report:raise HTTPException(404,"Patient report not found")
    return put_message(user,conversation_id,"Shared report: "+str(report.get("reportType") or report.get("fileName","Report")),
        messageType="report_reference",attachmentId=payload.referenceId,attachmentType="report")
