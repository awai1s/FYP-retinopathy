from typing import Literal, Optional, Union

from pydantic import BaseModel, EmailStr, Field


class UserSignup(BaseModel):
    name: str
    username: str
    email: EmailStr
    password: str
    role: Literal["Patient", "Doctor", "Hospital"]
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    age: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str


class ResendOTP(BaseModel):
    email: EmailStr


class SendOTP(BaseModel):
    email: EmailStr


class CreatePrescription(BaseModel):
    patientId: str
    medicationDetails: str
    instructions: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    otp: str


class PasswordReset(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class PatientProfileUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    username: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[Union[int, str]] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    emergencyContact: Optional[str] = Field(default=None, max_length=80)
    allergies: Optional[str] = Field(default=None, max_length=1000)


class ProfileRoleUpdate(BaseModel):
    role: Literal["Patient", "Doctor", "Hospital"]


class CreateAppointment(BaseModel):
    doctorId: str = Field(min_length=1, max_length=128)
    date: str = Field(min_length=1, max_length=32)
    time: str = Field(min_length=1, max_length=64)
    reason: Optional[str] = Field(default="", max_length=1000)


class UpdateAppointmentStatus(BaseModel):
    status: Literal["Pending", "Confirmed", "Completed", "Cancelled", "Rejected"]


class ProviderVerificationDetailsUpdate(BaseModel):
    # Doctor verification fields
    fullName: Optional[str] = Field(default=None, max_length=160)
    identityNumber: Optional[str] = Field(default=None, max_length=80)
    medicalLicenseNumber: Optional[str] = Field(default=None, max_length=120)
    licensingAuthority: Optional[str] = Field(default=None, max_length=160)
    specialization: Optional[str] = Field(default=None, max_length=160)
    qualification: Optional[str] = Field(default=None, max_length=240)
    yearsOfExperience: Optional[int] = Field(default=None, ge=0, le=80)
    licenseIssueDate: Optional[str] = Field(default=None, max_length=32)
    licenseExpiryDate: Optional[str] = Field(default=None, max_length=32)
    currentHospitalClinic: Optional[str] = Field(default=None, max_length=240)

    # Hospital verification fields
    hospitalName: Optional[str] = Field(default=None, max_length=240)
    registrationNumber: Optional[str] = Field(default=None, max_length=120)
    facilityType: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=120)
    officialEmail: Optional[EmailStr] = None
    responsibleContactPerson: Optional[str] = Field(default=None, max_length=160)
    registrationAuthority: Optional[str] = Field(default=None, max_length=160)
    registrationExpiry: Optional[str] = Field(default=None, max_length=32)

    # Shared provider fields
    phone: Optional[str] = Field(default=None, max_length=40)
    address: Optional[str] = Field(default=None, max_length=500)


class VerificationDecisionRequest(BaseModel):
    decision: Literal["verify", "request_changes", "reject", "suspend", "reactivate", "disable"]
    reason: str = Field(min_length=2, max_length=1000)
