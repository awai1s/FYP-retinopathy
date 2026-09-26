import AsyncStorage from "@react-native-async-storage/async-storage";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Language = "en" | "ur";

const translations = {
  en: {
    // =====================================================
    // LANGUAGE
    // =====================================================

    english: "English",
    urdu: "Urdu",
    switchLanguage: "Switch language",
    language: "Language",

    // =====================================================
    // PORTALS
    // =====================================================

    patientPortal: "Patient Portal",
    doctorPortal: "Doctor Portal",
    hospitalPortal: "Hospital Portal",

    // =====================================================
    // GENERAL
    // =====================================================

    welcome: "Welcome",
    welcomeBack: "Welcome back",
    dashboard: "Dashboard",
    loading: "Loading...",
    unableToLoad: "Unable to load this information.",
    tryAgain: "Try Again",

    // =====================================================
    // LOGIN / AUTHENTICATION
    // =====================================================

    signIn: "Sign in",
    signingIn: "Signing in...",
    emailAddress: "Email address",
    password: "Password",
    forgotPassword: "Forgot password?",
    dontHaveAccount: "Don't have an account?",
    createOne: "Create one",
    createAccount: "Create an account",

    pleaseEnterEmailPassword:
      "Please enter your email and password.",

    loginTokenError:
      "Login succeeded but no authentication token was returned.",

    couldNotConnect:
      "Could not connect to the server.",

    success: "Success",
    error: "Error",

    welcomePatient:
      "Welcome to EyeCare AI!",

    welcomeDoctor:
      "Welcome to the Doctor Portal!",

    welcomeHospital:
      "Welcome to the Hospital Portal!",

    loginSuccessful:
      "Login successful!",

    roleNotDetermined:
      "Your account role could not be determined. Please contact support.",

    retinalHealthJourney:
      "to continue your retinal health journey.",

    // =====================================================
    // SIGNUP
    // =====================================================

    signupCreateAccount: "Create Account",
    signupStep1Of4: "Step 1 of 4",
    signupStep2Of4: "Step 2 of 4",
    signupStep3Of4: "Step 3 of 4",
    signupStep4Of4: "Step 4 of 4",

    firstName: "First Name",
    lastName: "Last Name",
    selectRole: "Select Role",
    patient: "Patient",
    doctor: "Doctor",
    hospital: "Hospital",
    gender: "Gender",
    age: "Age",
    years: "Years",
    mobileNumber: "Mobile Number",

    next: "Next",

    accountInformation: "Account Information",
    username: "Username",
    continue: "Continue",

    missingInformation: "Missing Information",

    pleaseCompleteAllFields:
      "Please complete all fields.",

    pleaseFillAllFields:
      "Please fill all fields.",

    // Keys currently used by Step 1
    completeAllFields:
      "Please complete all fields.",

    invalidFirstName:
      "Invalid First Name",

    invalidLastName:
      "Invalid Last Name",

    onlyAlphabetsAllowed:
      "Only alphabets are allowed.",

    // Keys currently used by Step 1
    alphabetsOnly:
      "Only alphabets are allowed.",

    invalidMobileNumber:
      "Invalid Mobile Number",

    validPakistaniMobile:
      "Enter a valid Pakistani mobile number, for example 03XXXXXXXXX.",

    invalidDateOfBirth:
      "Invalid Date of Birth",

    selectValidDateOfBirth:
      "Please select a valid date of birth.",

    invalidUsername:
      "Invalid Username",

    usernameRequirements:
      "Username must be 4-20 characters and can contain letters, numbers and underscores.",

    invalidEmail:
      "Invalid Email",

    validEmail:
      "Please enter a valid email address.",

    // Keys currently used by Step 2
    fillAllFields:
      "Please fill all fields.",

    validEmailAddress:
      "Please enter a valid email address.",

    otpSent:
      "OTP Sent",

    verificationCodeSent:
      "A verification code has been sent to your email.",
    
    logout: "Log out",
    loggingOut: "Logging out...",
    confirmLogout: "Confirm logout",
    confirmLogoutMessage: "Are you sure you want to log out now?",
    cancel: "Cancel",
    logoutUnavailable: "Logout unavailable. Please try again.",

    // =====================================================
    // EMAIL VERIFICATION
    // =====================================================

    verifyEmail:
      "Verify Email",

    enterVerificationCode:
      "Enter the 6-digit verification code sent to your email.",

    enterOtp:
      "Enter OTP",

    resendOtpIn:
      "Resend OTP in",

    seconds:
      "s",

    didntReceiveCode:
      "Didn't receive the code?",

    resendOtp:
      "Resend OTP",

    newVerificationCodeSent:
      "A new verification code has been sent.",

    invalidOtp:
      "Invalid OTP",

    enterSixDigitCode:
      "Please enter the 6-digit code.",

    verificationFailed:
      "Verification Failed",

    invalidOrExpiredOtp:
      "Invalid or expired OTP",

    missingEmailParameter:
      "Email address is missing from session. Please restart signup.",

    missingEmail:
      "Missing email parameter.",

    couldNotSendOtp:
      "Could not send OTP.",

    // =====================================================
    // PASSWORD / SECURITY
    // =====================================================

    securitySetup:
      "Security Setup",

    createSecurePassword:
      "Create a secure password",

    passwordPlaceholder:
      "Password",

    confirmPassword:
      "Confirm Password",

    passwordStrength:
      "Password Strength",

    weak:
      "Weak",

    medium:
      "Medium",

    strong:
      "Strong",

    passwordRequired:
      "Please enter your password.",

    passwordRequirements:
      "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.",

    passwordsDoNotMatch:
      "Passwords do not match.",

    acceptTerms:
      "I accept the Terms & Conditions",

    accountRole:
      "Account Role",

    notSelected:
      "Not selected",

    roleMissing:
      "Your account role is missing. Please go back and select a role.",

    accountInformationIncomplete:
      "Your account information is incomplete. Please restart signup.",

    usernameOrEmailMissing:
      "Your username or email is missing. Please restart signup.",

    accountCreated:
      "Account Created",

    accountCreatedSuccessfully:
      "Your account was created successfully.",

    continueToLogin:
      "Continue to Login",

    couldNotCreateAccount:
      "Could not create your account. Please try again.",

    // =====================================================
    // PATIENT
    // =====================================================

    searchPatient:
      "Search Patient",

    searchPatientDescription:
      "Search patient using mobile number or username.",

    recentPatients:
      "Recent Patients",

    recentPatientsDescription:
      "Recently accessed patients will appear here.",

    aiReports:
      "AI Reports",

    aiReportsDescription:
      "Stored screening summaries will appear here.",

    appointments:
      "Appointments",

    appointmentsDescription:
      "Book and review eye-care appointments.",

    manageVisits:
      "Manage your doctor visits and follow-ups",

    upcomingAppointments:
      "Upcoming Appointments",

    noUpcomingAppointments:
      "No upcoming appointments",

    bookAppointment:
      "Book Appointment",

    loadingAppointments:
      "Loading appointments...",

    notifications:
      "Notifications",

    messages:
      "Messages",

    notificationsDescription:
      "Review appointment and care updates.",

    stayUpdated:
      "Stay updated with your eye care.",

    loadingNotifications:
      "Loading notifications...",

    allCaughtUp:
      "All caught up",

    unread:
      "unread",

    markAllRead:
      "Mark all read",

    noNotifications:
      "No Notifications",

    caughtUpMessage:
      "You are all caught up. New healthcare updates will appear here.",

    recently:
      "Recently",

    visionTests:
      "Vision Tests",

    visionTestsDescription:
      "Complete guided vision checks and save results.",

    uploadScreening:
      "Upload Screening",

    uploadScreeningDescription:
      "Upload a retinal image for screening.",

    analytics:
      "My Analytics",

    analyticsDescription:
      "Review your saved screening trends.",

    prescriptions:
      "Prescriptions",

    prescriptionsDescription:
      "Review prescriptions issued by your care team.",

    history:
      "History",

    profile:
      "Profile",

    reports:
      "Reports",

    // =====================================================
    // HOSPITAL
    // =====================================================

    hospitalOverview:
      "Hospital Overview",

    hospitalOverviewDescription:
      "View live statistics, patients, doctors, and activity.",

    auditLogs:
      "Audit Logs",

    auditLogsDescription:
      "Review read-only security activity for this hospital account.",

    uploadClinicalReport:
      "Upload Clinical Report",

    uploadClinicalReportDescription:
      "Upload reports provided by hospital.",

    viewReports:
      "View Reports",

    viewReportsDescription:
      "View uploaded clinical reports.",

    loginSuccess:
      "Login successful!",

    roleError:
      "Your account role could not be determined. Please contact support.",

    serverError:
      "Could not connect to the server.",

    continueJourney:
      "to continue your retinal health journey.",
    
    clinicalTools: "Clinical Tools",
    clinicalToolsDescription:
      "Review alerts and record patient care actions.",

    alerts: "Alerts",
    noHighRiskAlerts:
      "No high-risk alerts are currently available.",

    patientCareNote: "Patient care note",
    patientId: "Patient ID",
    writeClinicalNote: "Write a clinical note",
    saveClinicalNote: "Save Note",

    followUp: "Follow-up",
    dueDate: "Due date (YYYY-MM-DD)",
    followUpReason: "Reason for follow-up",
    createFollowUp: "Create Follow-up",

    saving: "Saving...",

    enterPatientAndNote:
    "Enter a patient ID and note.",

    enterPatientDueDateReason:
    "Enter a patient ID, due date, and follow-up reason.",

    noteSaved: "Note saved",
    patientNoteSaved:
    "The patient note was saved.",

    followUpCreated: "Follow-up created",
    followUpSaved:
      "The follow-up was saved.",

    unableToLoadDoctorAlerts:
  "Unable to load doctor alerts.",

    unableToSaveNote:
    "Unable to save note.",

    unableToCreateFollowUp:
    "Unable to create follow-up.",

    screeningAlert: "Screening alert",
    notSpecified: "Not specified",

    patientLabel: "Patient",
    aiDoctorSummary: "AI Doctor Summary",
clinicalSummaryDescription:
  "Clinical summary based on your saved retinal screening record.",
analysisId: "Analysis ID",

patientOverview: "Patient Overview",
clinicalFindings: "Clinical Findings",
assessment: "Assessment",
recommendedActions: "Recommended Actions",

summaryNotDiagnosis:
  "This summary is based on stored screening data and is not a diagnosis.",

noSummaryAvailable: "No Summary Available",

noStoredSummary:
  "No stored summary is available for this screening.",

completeRetinalAnalysis:
  "Complete a retinal image analysis first to generate a summary.",

downloadDoctorSummary:
  "Download Doctor Summary",

preparingDownload:
  "Preparing download...",

summaryUnavailable:
  "Summary unavailable",

unableToLoadStoredSummary:
  "Unable to load the stored screening summary.",

downloadUnavailable:
  "Download unavailable",

unableToDownloadSummary:
  "Unable to download the summary.",

patientProfile: "Patient Profile",
loadingPatientDetails: "Loading patient details...",
usernameNotAvailable: "Username not available",
viewAiDoctorSummary: "View AI Doctor Summary",
viewRetinalImages: "View Retinal Images",
createPrescription: "Create Prescription",
viewStoredClinicalSummary:
  "View stored clinical screening summary",
viewPatientRetinalImages:
  "View patient retinal images",
couldNotLoadPatientDetails:
  "Could not load patient details.",
email: "Email",
dateOfBirth: "Date of Birth",

noResults: "No results",
noPatientFound: "No patient found",
searchError: "Error",
failedToSearchPatient: "Failed to search patient",

searchPatientSubtitle: "Search using Username or Mobile Number",
searchPatientPlaceholder: "Enter Username or Mobile Number",
searching: "Searching...",
search: "Search",

noPatientSelected: "No Patient Selected",
searchPatientToViewProfile:
  "Search patient using username or mobile number to view profile.",
unableToLoadAppointments: "Unable to load appointments",
pleaseTryAgain: "Please try again.",
unableToUpdateAppointment: "Unable to update appointment",
doctorAppointments: "Doctor Appointments",
doctorAppointmentsDescription:
  "Review visits and communicate appointment decisions.",
noAppointmentsWaiting:
  "No appointments are waiting for review.",
pending: "Pending",
confirmed: "Confirmed",
rejected: "Rejected",
completed: "Completed",
confirm: "Confirm",
reject: "Reject",
markCompleted: "Mark completed",
back: "Back",
unableToLoadAuditLogs: "Unable to load audit logs.",
loadingAuditLogs: "Loading audit logs...",

noAuditActivity: "No audit activity recorded yet.",
dateUnavailable: "Date unavailable",
recentActivity: "Recent Activity",
noRecentActivity: "No recent activity has been recorded.",
clinicalActivity: "Clinical Activity",
doctors: "Doctors",
patients: "Patients",
unableToLoadClinicalReports: "Unable to load clinical reports.",
unableToDownloadReport: "Unable to download this report.",
loadingClinicalReports: "Loading clinical reports...",
clinicalReports: "Clinical Reports",
viewAllUploadedClinicalReports: "View all uploaded clinical reports",
noReportsAvailable: "No Reports Available",
hospitalReportsWillAppearHere: "Reports uploaded by the hospital will appear here.",
report: "Report",
hospitalReport: "Hospital report",
uploadDate: "Upload Date",
notProvided: "Not provided",
status: "Status",
download: "Download",
preparing: "Preparing...",
downloadReport: "Download Report",
enterUsernameOrMobile: "Enter a username or mobile number.",
failedToSearchPatients: "Failed to search patients.",
searchPatientToViewProfileAndReports: "Search for a patient to view profile and upload reports.",


reportType: "Report Type",
clinicalReport: "Clinical Report",
eyeExamination: "Eye Examination",
bloodReport: "Blood Report",
medicalHistory: "Medical History",
hospitalName: "Hospital Name",
enterHospitalName: "Enter hospital name",
doctorName: "Doctor Name",
enterDoctorName: "Enter doctor's name",
reportDescription: "Report Description",
enterReportDetails: "Enter report details...",
selectPdfOrImage: "Select PDF / Image",
submitReport: "Submit Report",
submitting: "Submitting...",


completeHospitalDoctorDescription: "Complete the hospital, doctor, and description fields.",
clinicalReportUploadedSuccessfully: "Clinical report uploaded successfully.",
couldNotUploadClinicalReport: "Could not upload the clinical report.",
uploadFailed: "Upload Failed",
noNewNotifications: "No new notifications",
cancelAppointment: "Cancel Appointment",
appointmentCancelConfirmation: "Are you sure you want to cancel your appointment with",
keep: "Keep",
appointmentCancelled: "Appointment Cancelled",
appointmentCancelledMessage: "Your appointment has been cancelled.",
unableToCancel: "Unable to Cancel",
unableToCancelAppointment:
  "Something went wrong while cancelling the appointment.",
medicalConsultation: "Medical consultation",
date: "Date",
time: "Time",
of: "of",
notSet: "Not set",
appointmentHistory: "Appointment History",
patientAnalytics: "Patient Analytics",
screeningActivityDescription:
  "Your screening and care activity from saved records.",
screenings: "Screenings",
latestScreening: "Latest screening",
noScreeningResult:
  "No screening result is available yet.",
scheduleVisit: "Schedule a visit with your doctor",
selectDoctor: "Select Doctor",
selectDoctorError: "Please select a doctor before continuing.",
selectDate: "Select Date",
selectDateError: "Please select an appointment date.",
selectTime: "Select Time",
selectTimeError: "Please select an appointment time.",
reasonForVisit: "Reason for Visit",
reasonPlaceholder:
  "Describe the reason for your appointment...",
reasonRequired: "Reason Required",
reasonRequiredMessage:
  "Please enter the reason for your appointment.",
appointmentSummary: "Appointment Summary",
confirmAppointment: "Confirm Appointment",
appointmentRequested: "Appointment Requested",
appointmentRequestedMessage:
  "Your appointment request has been submitted successfully.",
viewAppointments: "View Appointments",
unableToBook: "Unable to Book",
unableToBookAppointment:
  "Something went wrong while booking your appointment.",
colorVision: "Color Vision",
visionScreening: "VISION SCREENING",
interactiveColorPerceptionScreening:
  "Interactive color perception screening.",
testYourColorVision: "Test your color vision",
colorVisionTestDescription:
  "You will see several colored plates containing numbers. Look carefully and select the number you can identify.",
beforeYouStart: "Before you start",

useGoodLighting: "Use good lighting",
useGoodLightingDescription:
  "Perform the test in a well-lit environment and avoid screen glare.",

keepScreenSteady: "Keep the screen steady",
keepScreenSteadyDescription:
  "Hold your device at a comfortable viewing distance and avoid zooming.",

lookCarefully: "Look carefully",
lookCarefullyDescription:
  "Take a few seconds to inspect each plate before selecting your answer.",

answerHonestly: "Answer honestly",
answerHonestlyDescription:
  "Choose the number you can actually see rather than repeatedly guessing.",

colorVisionEducationalNotice:
  "This is an educational screening tool. It is not a calibrated diagnostic color vision examination.",

startTest: "Start Test",

screeningComplete: "SCREENING COMPLETE",
yourResult: "Your Result",

normalScreeningResult: "Normal Screening Result",
normalScreeningDescription:
  "You identified most of the color vision plates correctly.",

someDifficultyDetected: "Some Difficulty Detected",
someDifficultyDescription:
  "Some color plates were difficult to identify. Consider repeating the screening or discussing the result with an eye-care professional.",

furtherEvaluationRecommended: "Further Evaluation Recommended",
furtherEvaluationDescription:
  "Several color plates were difficult to identify. A professional color vision assessment may be helpful.",

accuracy: "accuracy",
correct: "Correct",
plates: "Plates",
today: "Today",

colorVisionResultNotice:
  "Color vision screening results should be interpreted carefully. If you experience difficulty with colors, discuss it with an eye-care professional.",

retakeTest: "Retake Test",
backToVisionTests: "Back to Vision Tests",

plate: "Plate",
colorPlate: "Color Plate",
whatNumberDoYouSee: "What number do you see?",
selectYourAnswer: "Select your answer",
correctAnswer: "Correct",
expectedAnswer: "The expected answer is",
colorVisionTestTip:
  "Look at the center of the plate and avoid zooming or changing the screen distance.",

preparingColorVisionTest: "Preparing color vision test...",
colorVisionScreeningSubtitle:
  "Interactive color perception screening.",

goodLighting: "Use good lighting",
goodLightingDescription:
  "Perform the test in a well-lit environment and avoid screen glare.",

steadyScreen: "Keep the screen steady",
steadyScreenDescription:
  "Hold your device at a comfortable viewing distance and avoid zooming.",

normalScreeningResultDescription:
  "You identified most of the color vision plates correctly.",


someDifficultyDetectedDescription:
  "Some color plates were difficult to identify. Consider repeating the screening or discussing the result with an eye-care professional.",

furtherEvaluationRecommendedDescription:
  "Several color plates were difficult to identify. A professional color vision assessment may be helpful.",

colorVisionPlate1Description:
  "Most people with normal color vision should be able to identify the number.",

colorVisionPlate2Description:
  "Identify the number formed by the differently colored dots.",

colorVisionPlate3Description:
  "Look carefully at the center of the plate.",

colorVisionPlate4Description:
  "Try to identify both digits in the center.",

colorVisionPlate5Description:
  "The two digits should appear clearly inside the circle.",

colorVisionPlate6Description:
  "Identify the final number before viewing your result.",
colorVisionSubtitle:
  "Interactive color perception screening.",
none: "None",
visualAcuity: "Visual Acuity",
visualAcuityScreening: "VISUAL ACUITY SCREENING",
visualAcuitySubtitle:
  "Interactive visual clarity screening for each eye.",
testYourVisualAcuity:
  "Test your visual acuity",
visualAcuityTestDescription:
  "You will identify letters displayed at different sizes. The screening checks each eye separately and then both eyes together.",

visualAcuityLightingTitle:
  "Use good lighting",
visualAcuityLightingDescription:
  "Perform the screening in a well-lit environment and avoid glare on the screen.",

visualAcuityDistanceTitle:
  "Keep a consistent distance",
visualAcuityDistanceDescription:
  "Keep your device at approximately 40 cm (16 inches) from your eyes and do not zoom the screen.",

visualAcuityGlassesTitle:
  "Use your usual vision correction",
visualAcuityGlassesDescription:
  "If you normally wear glasses or contact lenses for distance vision, keep them on during the screening.",

visualAcuityCoverTitle:
  "Cover one eye when instructed",
visualAcuityCoverDescription:
  "Cover the requested eye gently without pressing on it. Do not close or squint with the eye being tested.",

visualAcuityReadingTitle:
  "Read honestly",
visualAcuityReadingDescription:
  "Choose the letters you can actually identify. Avoid guessing or repeatedly changing your answer.",

visualAcuityEducationalNotice:
  "This is an educational screening tool and is not a calibrated clinical eye examination or diagnosis.",

rightEye: "Right Eye",
leftEye: "Left Eye",
bothEyes: "Both Eyes",

rightEyeInstructionTitle:
  "Test your right eye",
leftEyeInstructionTitle:
  "Test your left eye",
bothEyesInstructionTitle:
  "Test both eyes",

rightEyeInstructionDescription:
  "Cover your left eye gently. Keep your right eye open and look directly at the letters on the screen.",

leftEyeInstructionDescription:
  "Cover your right eye gently. Keep your left eye open and look directly at the letters on the screen.",

bothEyesInstructionDescription:
  "Keep both eyes open and look directly at the letters on the screen.",

recommendedDistance:
  "Recommended distance: about 40 cm / 16 inches",

visualAcuityEyeTip:
  "Keep the device steady, do not zoom, and maintain the same viewing distance throughout this section.",

whatLettersDoYouSee:
  "What letters do you see?",

visualAcuityQuestionDescription:
  "Look carefully at the chart and select the option that matches what you can see.",

selectWhatYouSee:
  "Select what you see",

cannotSee:
  "Cannot see",

visualAcuityExpectedAnswer:
  "The expected answer is {answer}.",

visualAcuityLine:
  "Visual Acuity Line",

lineProgress:
  "Line {current} of {total}",

eyeResults:
  "Eye Results",

visualAcuityNormalResult:
  "Normal Screening Result",

visualAcuityNormalDescription:
  "You identified most of the visual acuity lines correctly during this screening.",

visualAcuityDifficultyResult:
  "Some Difficulty Detected",

visualAcuityDifficultyDescription:
  "Some lines were difficult to identify. Consider repeating the screening or discussing your vision with an eye-care professional.",

visualAcuityFollowupResult:
  "Further Evaluation Recommended",

visualAcuityFollowupDescription:
  "Several visual acuity lines were difficult to identify. A professional eye examination may be helpful.",

visualAcuityResultNotice:
  "This screening does not measure a clinical 20/20 or Snellen visual-acuity value. If you have difficulty seeing clearly, please discuss it with an eye-care professional.",

visualAcuityTestTip:
  "Keep the device at the same distance and avoid zooming or changing your viewing position.",

unableToSaveScreening:
  "Could not save screening",

    visionTestsSubtitle: "Complete vision checks and track your results.", 
    beforeYouBegin: "Before you begin", 
    visionTestsNotice: "These tests are screening and monitoring tools. They do not replace a professional eye examination.", 
    availableTests: "Available Tests", 
    visualAcuityDescription: "Check how clearly you can see letters and symbols at different sizes.", 
    visualAcuityDuration: "About 2 to 3 minutes", 
    amslerGrid: "Amsler Grid", 
    amslerGridDescription: "Check for areas of distortion, missing lines, or changes in central vision.", 
    amslerGridDuration: "About 1 to 2 minutes", 
    colorVisionDescription: "Check your ability to distinguish common color patterns.", 
    colorVisionDuration: "About 2 minutes", 
    visionTestsFooter: "Your test results can be reviewed alongside your other eye-health information.",
    amslerCheckCentralVision: "Check your central vision", 
    amslerDescription: "Look at the center of the grid and check whether any lines appear wavy, broken, missing, blurry, or distorted.", 
    amslerUseReadingGlasses: "Use your usual reading glasses", 
    amslerUseReadingGlassesDescription: "If you normally use glasses for close-up viewing, wear them during the test.", 
    amslerTestOneEye: "Test one eye at a time", 
    amslerTestOneEyeDescription: "Cover one eye without pressing on it. Test your right eye first, then your left eye.", 
    amslerKeepScreenComfortable: "Keep the screen comfortable", 
    amslerKeepScreenComfortableDescription: "Hold your device at a normal reading distance and keep that distance consistent.", 
    amslerMarkUnusualAreas: "Mark unusual areas", 
    amslerMarkUnusualAreasDescription: "Tap any area of the grid that looks wavy, missing, blurred, broken, or distorted.", 
    amslerScreeningNotice: "This is a screening and self-monitoring tool. It does not replace a professional eye examination.", 
    marked: "marked", 
    amslerFocusCenter: "Focus on the center dot", 
    amslerDoesGridLookNormal: "Does the grid look normal?", 
    amslerTapDistortedAreas: "Keep looking at the center. Tap areas that look wavy, broken, missing, or distorted.", 
    amslerKeepGazeCenter: "Keep your gaze on the center dot while checking the surrounding lines.", 
    clearMarks: "Clear Marks", 
    testLeftEye: "Test Left Eye", 
    finishTest: "Finish Test", 
    amslerRightEyeCompleteHint: "When you finish checking the right eye, continue to the left eye.", 
    amslerNoAreasMarked: "No Areas Marked", 
    amslerNoAreasDescription: "You did not identify any areas that appeared distorted or unusual during this screening.", 
    amslerMinorChanges: "Minor Changes Reported", 
    amslerMinorChangesDescription: "You marked a small number of areas that appeared unusual. Repeat the test carefully and monitor any changes.", 
    amslerFollowUpRecommended: "Follow-up Recommended", 
    amslerFollowUpDescription: "You marked several areas that appeared distorted or unusual. Consider discussing this result with an eye-care professional.", 
    amslerResultNotice: "If straight lines appear distorted, broken, missing, or wavy, contact an eye-care professional for further evaluation.",

  historyRecords: "Your Records",
historySubtitle: "Review your previous reports and AI predictions.",
loadingHistory: "Loading your history",
retrievingHistory: "Retrieving your previous records...",
medicalReport: "Medical Report",
medicalRecord: "Medical Record",
recent: "Recent",
processing: "Processing",
openRecord: "Open",
viewResult: "View result",
noHistoryYet: "No History Yet",
historyEmptyDescription:
  "Your uploaded retinal scans, reports, and AI predictions will appear here once you start using EyeCare AI.",
uploadScan: "Upload a Scan",
manageAccount: "Manage your EyeCare AI account",
personalInformation: "Personal Information",

male: "Male",
female: "Female",
preferNotToSay: "Prefer not to say",
transgender: "Transgender",

automaticallyCalculated: "Automatically calculated",
editProfile: "Edit Profile",
cancelEditing: "Cancel Editing",
saveChanges: "Save Changes",
profileUpdatedSuccessfully: "Profile updated successfully.",
failedToLoadProfile: "Failed to load profile",
failedToUpdateProfile: "Failed to update profile",
screeningConsent: "Screening consent",
screeningConsentDescription:
  "Allow this account to save retinal screening results for care and analytics.",
on: "On",
off: "Off",
consentUnavailable: "Consent unavailable",
unableToUpdateScreeningConsent:
  "Unable to update screening consent.",
logOut: "Log Out",
logoutConfirmation:
  "Are you sure you want to log out of your account?",

loadingProfile: "Loading your profile...",
securePatientWorkspace: "EyeCare AI • Secure Patient Workspace",
enterFirstName: "Enter first name",
enterLastName: "Enter last name",
enterUsername: "Enter username",
enterEmail: "Enter email",
enterMobileNumber: "Enter mobile number",
usernamePlaceholder: "username",
user: "User",
unableToUpdateConsent: "Unable to update screening consent.",
bloodGroup: "Blood Group",
enterBloodGroup: "Enter blood group",
address: "Address",
enterAddress: "Enter address",
eyeCareAISecureWorkspace: "EyeCare AI • Secure Patient Workspace",
permissionRequired: "Permission Required",
photoLibraryPermission: "Please allow access to your photo library.",
unableToSelectRetinalImage: "Unable to select retinal image.",
unableToSelectDocument: "Unable to select document.",
noFileSelected: "No File Selected",
pleaseSelectFileFirst: "Please select a file first.",
imageQualityTooLow: "Image quality too low",
chooseClearerRetinalImage: "Please choose a clearer retinal image.",
uploadSuccessful: "Upload Successful",
predictionIdNotReturned: "Your file was uploaded, but the prediction ID was not returned.",
failedToUploadFile: "Failed to upload file.",
uploadReports: "Upload Reports",
uploadReportsDescription: "Upload your medical reports or retinal scans for analysis.",
supportedUploadFiles: "Supported files include retinal images, PDF reports and clinical documents.",
retinalFundusImage: "Retinal Fundus Image",
uploadRetinalScan: "Upload retinal scan",
laboratoryReport: "Laboratory Report",
uploadLaboratoryDocument: "Upload laboratory document",
prescription: "Prescription",
uploadDoctorPrescription: "Upload doctor prescription",
uploadHospitalReport: "Upload hospital report",
selectedFile: "Selected File",
removeSelectedFile: "Remove selected file",
uploading: "Uploading...",
uploadSelectedFile: "Upload Selected File",
medicalFilesSecure: "Your medical files are handled securely.",
aiAnalysisResult: "AI Analysis Result",
yourRetinalAnalysisProcessed: "Your retinal analysis has been processed.",
analyzingResults: "Analyzing Results",
pleaseWaitAiAnalysisLoaded: "Please wait while your AI analysis is loaded.",
couldNotLoadResult: "Could not load result.",
noAnalysisAvailable: "No Analysis Available",
uploadRetinalImageToGenerate: "Upload a retinal image to generate AI diagnosis results.",
uploadAScan: "Upload a Scan",
aiDiagnosis: "AI DIAGNOSIS",
unknown: "Unknown",
predictionConfidence: "Prediction Confidence",
aiModelConfidence: "AI model confidence in this result",
noClinicalFindings: "No clinical findings were provided.",
recommendations: "Recommendations",
noRecommendations: "No recommendations were provided.",

comingSoon: "Coming Soon",
reportDownloadBackendUnavailable: "The report download feature will be connected when the backend endpoint is available.",
backToDashboard: "Back to Dashboard",
confidence: "Confidence",
riskLevel: "Risk Level",
  viewPrescriptionsIssuedByDoctors:
    "View prescriptions issued by your doctors",
  loadingPrescriptions: "Loading prescriptions...",
  unableToLoadPrescriptions: "Unable to load prescriptions.",
  dateNotAvailable: "Date not available",
  noPrescriptionsYet: "No prescriptions yet",
  prescriptionsWillAppearHere:
    "Your prescriptions will appear here when a doctor issues one for you.",
  yourPrescriptions: "Your Prescriptions",
  medication: "Medication",
  noMedicationDetailsProvided:
    "No medication details provided.",
  instructions: "Instructions",
  noInstructionsProvided:
    "No instructions provided.",
  goBack: "Go back",
  close: "Close",
  noConnectedDoctors: "No connected doctors",
  openMyDoctors: "Open My Doctors to send a request.",
  selectDateFirst: "Select a date to see available slots.",
  noAvailability: "No availability is published for this date.",
  manageConnections: "Manage connections",
  connectionRequired: "Connection required",
  acceptConnectionBeforeClinicalDetails: "Accept a Patient–Doctor connection before viewing clinical details.",
  specialization: "Specialization",
  hospitalClinic: "Hospital / Clinic",
  pmdcNumber: "PMDC Number",
  doctorFieldsRequired: "Please complete specialization, hospital/clinic, and PMDC number.",
  professionalInformation: "Professional Information",
  licenseNumber: "PMDC Number",
  experience: "Experience",
  doctorProfile: "Doctor Profile",
  myDoctors: "My Doctors",
  myPatients: "My Patients",
  connectedClinicians: "Connected Clinicians",
  connectedPatients: "Connected Patients",
  manageDoctorsDesc: "Manage connected clinicians & care team",
  messagesDesc: "Chat securely with connected doctors",
  notificationsDesc: "Stay updated with appointments and alerts",
  myAnalysis: "My Analysis",
  myAnalysisDesc: "View saved screening trends.",
    
myDoctorsDescription: "Manage connected clinicians & care team",
messagesDescription: "Chat securely with connected doctors",
startSecureConversation: "Start Secure Conversation",
loadingMessages: "Loading messages...",
unableToLoadMessages: "Unable to load messages.",
noMessagesYet: "No messages yet",
secureCareChat: "SECURE CARE CHAT",
acceptedConnectionsOnly:
  "Only accepted connections appear here.",
noConversationsYet: "No conversations yet",
acceptConnectionToStartConversation:
  "Accept a Doctor-Patient connection to start a secure conversation.",
openConversationWith: "Open conversation with",

    patientDashboardSubtitle:
      "A complete dashboard for your eye health and diabetic care.",
    healthOverview: "Health Overview",
    eyeHealth: "Eye Health",
    predictions: "Predictions",
    latestScreeningResult: "Latest Screening Result",
    stage: "Stage",
    newRetinalScan: "New Retinal Scan",
    newRetinalScanDescription:
      "Upload a new eye scan to receive a diabetic retinopathy analysis quickly.",
    quickActionsAndFeatures: "Quick Actions and Features",
  // English section

  

  },

  // =======================================================
  // URDU
  // =======================================================

  ur: {
    // =====================================================
    // LANGUAGE
    // =====================================================

    english: "انگریزی",
    urdu: "اردو",
    switchLanguage: "زبان تبدیل کریں",
    language: "زبان",

    // =====================================================
    // PORTALS
    // =====================================================

    patientPortal: "مریض پورٹل",
    doctorPortal: "ڈاکٹر پورٹل",
    hospitalPortal: "ہسپتال پورٹل",

    // =====================================================
    // GENERAL
    // =====================================================

    welcome: "خوش آمدید",
    welcomeBack: "خوش آمدید",
    dashboard: "ڈیش بورڈ",
    loading: "لوڈ ہو رہا ہے...",
    unableToLoad:
      "یہ معلومات لوڈ نہیں کی جا سکیں۔",
    tryAgain: "دوبارہ کوشش کریں",

    // =====================================================
    // LOGIN / AUTHENTICATION
    // =====================================================

    signIn: "سائن اِن",
    signingIn: "سائن اِن ہو رہا ہے...",
    emailAddress: "ای میل ایڈریس",
    password: "پاس ورڈ",
    forgotPassword: "پاس ورڈ بھول گئے؟",
    dontHaveAccount: "اکاؤنٹ نہیں ہے؟",
    createOne: "اکاؤنٹ بنائیں",
    createAccount: "اکاؤنٹ بنائیں",

    pleaseEnterEmailPassword:
      "براہِ کرم اپنی ای میل اور پاس ورڈ درج کریں۔",

    loginTokenError:
      "لاگ اِن کامیاب ہوگیا لیکن تصدیقی ٹوکن موصول نہیں ہوا۔",

    couldNotConnect:
      "سرور سے رابطہ نہیں ہو سکا۔",

    success:
      "کامیابی",

    error:
      "خرابی",

    welcomePatient:
      "EyeCare AI میں خوش آمدید!",

    welcomeDoctor:
      "ڈاکٹر پورٹل میں خوش آمدید!",

    welcomeHospital:
      "ہسپتال پورٹل میں خوش آمدید!",

    loginSuccessful:
      "لاگ اِن کامیاب ہوگیا!",

    roleNotDetermined:
      "آپ کے اکاؤنٹ کا کردار معلوم نہیں ہوسکا۔ براہِ کرم سپورٹ سے رابطہ کریں۔",

    retinalHealthJourney:
      "اپنے ریٹینا کی صحت کے سفر کو جاری رکھنے کے لیے۔",

    // =====================================================
    // SIGNUP
    // =====================================================

    signupCreateAccount:
      "اکاؤنٹ بنائیں",

    signupStep1Of4:
      "مرحلہ 1 از 4",

    signupStep2Of4:
      "مرحلہ 2 از 4",

    signupStep3Of4:
      "مرحلہ 3 از 4",

    signupStep4Of4:
      "مرحلہ 4 از 4",

    firstName:
      "پہلا نام",

    lastName:
      "آخری نام",

    selectRole:
      "کردار منتخب کریں",

    patient:
      "مریض",

    doctor:
      "ڈاکٹر",

    hospital:
      "ہسپتال",

    gender:
      "جنس",

    age:
      "عمر",

    years:
      "سال",

    mobileNumber:
      "موبائل نمبر",

    next:
      "اگلا",

    accountInformation:
      "اکاؤنٹ کی معلومات",

    username:
      "صارف نام",

    continue:
      "جاری رکھیں",

    missingInformation:
      "معلومات نامکمل ہیں",

    pleaseCompleteAllFields:
      "براہِ کرم تمام فیلڈز مکمل کریں۔",

    pleaseFillAllFields:
      "براہِ کرم تمام فیلڈز پُر کریں۔",

    // Keys currently used by Step 1
    completeAllFields:
      "براہِ کرم تمام خانے مکمل کریں۔",

    invalidFirstName:
      "غلط پہلا نام",

    invalidLastName:
      "غلط آخری نام",

    onlyAlphabetsAllowed:
      "صرف حروف کی اجازت ہے۔",

    // Keys currently used by Step 1
    alphabetsOnly:
      "صرف حروف کی اجازت ہے۔",

    invalidMobileNumber:
      "غلط موبائل نمبر",

    validPakistaniMobile:
      "درست پاکستانی موبائل نمبر درج کریں، مثال کے طور پر 03XXXXXXXXX۔",

    invalidDateOfBirth:
      "غلط تاریخ پیدائش",

    selectValidDateOfBirth:
      "براہِ کرم تاریخ پیدائش درست منتخب کریں۔",

    invalidUsername:
      "غلط صارف نام",

    usernameRequirements:
      "صارف نام 4 سے 20 حروف پر مشتمل ہونا چاہیے اور اس میں حروف، اعداد اور انڈر اسکور شامل ہوسکتے ہیں۔",

    invalidEmail:
      "غلط ای میل",

    validEmail:
      "براہِ کرم درست ای میل ایڈریس درج کریں۔",

    // Keys currently used by Step 2
    fillAllFields:
      "براہِ کرم تمام خانے پُر کریں۔",

    validEmailAddress:
      "براہِ کرم درست ای میل ایڈریس درج کریں۔",

    otpSent:
      "OTP بھیج دیا گیا",

    verificationCodeSent:
      "تصدیقی کوڈ آپ کی ای میل پر بھیج دیا گیا ہے۔",
    
    logout: "لاگ آؤٹ",
    loggingOut: "لاگ آؤٹ ہو رہا ہے...",
    confirmLogout: "لاگ آؤٹ کی تصدیق",
    confirmLogoutMessage:
      "کیا آپ واقعی ابھی لاگ آؤٹ کرنا چاہتے ہیں؟",
    cancel: "منسوخ کریں",
    logoutUnavailable:
        "لاگ آؤٹ دستیاب نہیں۔ براہِ کرم دوبارہ کوشش کریں۔",
    // =====================================================
    // EMAIL VERIFICATION
    // =====================================================

    verifyEmail:
      "ای میل کی تصدیق کریں",

    enterVerificationCode:
      "اپنی ای میل پر بھیجا گیا 6 ہندسوں کا تصدیقی کوڈ درج کریں۔",

    enterOtp:
      "OTP درج کریں",

    resendOtpIn:
      "OTP دوبارہ بھیجنے میں",

    seconds:
      "سیکنڈ",

    didntReceiveCode:
      "کوڈ موصول نہیں ہوا؟",

    resendOtp:
      "OTP دوبارہ بھیجیں",

    newVerificationCodeSent:
      "نیا تصدیقی کوڈ بھیج دیا گیا ہے۔",

    invalidOtp:
      "غلط OTP",

    enterSixDigitCode:
      "براہِ کرم 6 ہندسوں کا کوڈ درج کریں۔",

    verificationFailed:
      "تصدیق ناکام ہوگئی",

    invalidOrExpiredOtp:
      "OTP غلط یا میعاد ختم ہوچکا ہے",

    missingEmailParameter:
      "سیشن میں ای میل ایڈریس موجود نہیں۔ براہِ کرم سائن اپ دوبارہ شروع کریں۔",

    missingEmail:
      "ای میل پیرامیٹر موجود نہیں۔",

    couldNotSendOtp:
      "OTP نہیں بھیجا جا سکا۔",

    // =====================================================
    // PASSWORD / SECURITY
    // =====================================================

    securitySetup:
      "سیکیورٹی سیٹ اپ",

    createSecurePassword:
      "محفوظ پاس ورڈ بنائیں",

    passwordPlaceholder:
      "پاس ورڈ",

    confirmPassword:
      "پاس ورڈ کی تصدیق کریں",

    passwordStrength:
      "پاس ورڈ کی مضبوطی",

    weak:
      "کمزور",

    medium:
      "درمیانہ",

    strong:
      "مضبوط",

    passwordRequired:
      "براہِ کرم اپنا پاس ورڈ درج کریں۔",

    passwordRequirements:
      "پاس ورڈ کم از کم 8 حروف پر مشتمل ہونا چاہیے، جس میں ایک بڑا حرف، ایک چھوٹا حرف، ایک عدد اور ایک خصوصی حرف شامل ہو۔",

    passwordsDoNotMatch:
      "پاس ورڈز ایک جیسے نہیں ہیں۔",

    acceptTerms:
      "میں شرائط و ضوابط قبول کرتا/کرتی ہوں",

    accountRole:
      "اکاؤنٹ کا کردار",

    notSelected:
      "منتخب نہیں کیا گیا",

    roleMissing:
      "آپ کے اکاؤنٹ کا کردار موجود نہیں۔ براہِ کرم واپس جاکر کردار منتخب کریں۔",

    accountInformationIncomplete:
      "آپ کے اکاؤنٹ کی معلومات نامکمل ہیں۔ براہِ کرم سائن اپ دوبارہ شروع کریں۔",

    usernameOrEmailMissing:
      "آپ کا صارف نام یا ای میل موجود نہیں۔ براہِ کرم سائن اپ دوبارہ شروع کریں۔",

    accountCreated:
      "اکاؤنٹ بن گیا",

    accountCreatedSuccessfully:
      "آپ کا اکاؤنٹ کامیابی سے بنا دیا گیا ہے۔",

    continueToLogin:
      "لاگ اِن پر جائیں",

    couldNotCreateAccount:
      "آپ کا اکاؤنٹ نہیں بنایا جا سکا۔ براہِ کرم دوبارہ کوشش کریں۔",

    // =====================================================
    // PATIENT
    // =====================================================

    searchPatient:
      "مریض تلاش کریں",

    searchPatientDescription:
      "موبائل نمبر یا صارف نام کے ذریعے مریض تلاش کریں۔",

    recentPatients:
      "حالیہ مریض",

    recentPatientsDescription:
      "حال ہی میں دیکھے گئے مریض یہاں ظاہر ہوں گے۔",

    aiReports:
      "AI رپورٹس",

    aiReportsDescription:
      "محفوظ شدہ اسکریننگ کے خلاصے یہاں ظاہر ہوں گے۔",

    appointments:
      "ملاقاتیں",

    appointmentsDescription:
      "آنکھوں کی دیکھ بھال کی ملاقاتیں بک کریں اور دیکھیں۔",

    manageVisits:
      "اپنے ڈاکٹر کے دوروں اور فالو اپس کا انتظام کریں",

    upcomingAppointments:
      "آنے والی ملاقاتیں",

    noUpcomingAppointments:
      "کوئی آنے والی ملاقات نہیں",

    bookAppointment:
      "ملاقات بک کریں",

    loadingAppointments:
      "ملاقاتیں لوڈ ہو رہی ہیں...",

    notifications:
      "اطلاعات",

    messages:
      "پیغامات",

    notificationsDescription:
      "ملاقاتوں اور دیکھ بھال سے متعلق تازہ معلومات دیکھیں۔",

    stayUpdated:
      "اپنی آنکھوں کی صحت کے بارے میں باخبر رہیں۔",

    loadingNotifications:
      "اطلاعات لوڈ ہو رہی ہیں...",

    allCaughtUp:
      "سب کچھ دیکھ لیا گیا",

    unread:
      "غیر پڑھی ہوئی",

    markAllRead:
      "سب کو پڑھا ہوا کریں",

    noNotifications:
      "کوئی اطلاعات نہیں",

    caughtUpMessage:
      "آپ نے تمام اطلاعات دیکھ لی ہیں۔ نئی طبی معلومات یہاں ظاہر ہوں گی۔",

    recently:
      "حالیہ",

    visionTests:
      "نظر کے ٹیسٹ",

    visionTestsDescription:
      "رہنمائی کے ساتھ نظر کے ٹیسٹ مکمل کریں اور نتائج محفوظ کریں۔",

    uploadScreening:
      "اسکریننگ اپ لوڈ کریں",

    uploadScreeningDescription:
      "اسکریننگ کے لیے ریٹینا کی تصویر اپ لوڈ کریں۔",

    analytics:
      "میرا تجزیہ",

    analyticsDescription:
      "اپنی محفوظ شدہ اسکریننگ کے رجحانات دیکھیں۔",

    prescriptions:
      "نسخے",

    prescriptionsDescription:
      "اپنی طبی دیکھ بھال کرنے والی ٹیم کے جاری کردہ نسخے دیکھیں۔",

    history:
      "تاریخ",

    profile:
      "پروفائل",

    reports:
      "رپورٹس",

    // =====================================================
    // HOSPITAL
    // =====================================================

    hospitalOverview:
      "ہسپتال کا جائزہ",

    hospitalOverviewDescription:
      "لائیو اعداد و شمار، مریضوں، ڈاکٹروں اور سرگرمیوں کا جائزہ لیں۔",

    auditLogs:
      "آڈٹ لاگز",

    auditLogsDescription:
      "اس ہسپتال اکاؤنٹ کی سیکیورٹی سرگرمیوں کا جائزہ لیں۔",

    uploadClinicalReport:
      "طبی رپورٹ اپ لوڈ کریں",

    uploadClinicalReportDescription:
      "ہسپتال کی فراہم کردہ رپورٹس اپ لوڈ کریں۔",

    viewReports:
      "رپورٹس دیکھیں",

    viewReportsDescription:
      "اپ لوڈ کی گئی طبی رپورٹس دیکھیں۔",

    loginSuccess:
      "لاگ اِن کامیاب ہوگیا!",

    roleError:
      "آپ کے اکاؤنٹ کا کردار معلوم نہیں ہوسکا۔ براہِ کرم سپورٹ سے رابطہ کریں۔",

    serverError:
      "سرور سے رابطہ نہیں ہوسکا۔",

    continueJourney:
      "اپنے ریٹینا کی صحت کے سفر کو جاری رکھنے کے لیے۔",

    clinicalTools: "طبی سہولیات",
clinicalToolsDescription:
  "الرٹس دیکھیں اور مریضوں کی دیکھ بھال سے متعلق اقدامات ریکارڈ کریں۔",

alerts: "الرٹس",
noHighRiskAlerts:
  "اس وقت کوئی زیادہ خطرے والے الرٹس دستیاب نہیں ہیں۔",

patientCareNote: "مریض کی طبی نوٹ",
patientId: "مریض کی شناخت",
writeClinicalNote: "طبی نوٹ لکھیں",
saveClinicalNote: "نوٹ محفوظ کریں",

followUp: "فالو اَپ",
dueDate: "آخری تاریخ (YYYY-MM-DD)",
followUpReason: "فالو اَپ کی وجہ",
createFollowUp: "فالو اَپ بنائیں",

saving: "محفوظ کیا جا رہا ہے...",

enterPatientAndNote:
  "مریض کی شناخت اور نوٹ درج کریں۔",

enterPatientDueDateReason:
  "مریض کی شناخت، آخری تاریخ اور فالو اَپ کی وجہ درج کریں۔",

noteSaved: "نوٹ محفوظ ہوگیا",
patientNoteSaved:
  "مریض کا نوٹ کامیابی سے محفوظ ہوگیا۔",

followUpCreated: "فالو اَپ بن گیا",
followUpSaved:
  "فالو اَپ کامیابی سے محفوظ ہوگیا۔",

unableToLoadDoctorAlerts:
  "ڈاکٹر کے الرٹس لوڈ نہیں کیے جا سکے۔",

unableToSaveNote:
  "نوٹ محفوظ نہیں کیا جا سکا۔",

unableToCreateFollowUp:
  "فالو اَپ نہیں بنایا جا سکا۔",

screeningAlert: "اسکریننگ الرٹ",
notSpecified: "مخصوص نہیں",

patientLabel: "مریض",
aiDoctorSummary: "AI ڈاکٹر خلاصہ",

clinicalSummaryDescription:
  "آپ کی محفوظ شدہ ریٹینا اسکریننگ کے ریکارڈ کی بنیاد پر طبی خلاصہ۔",

analysisId: "تجزیہ ID",

patientOverview: "مریض کا جائزہ",

clinicalFindings: "طبی نتائج",

assessment: "تشخیص اور جائزہ",

recommendedActions:
  "تجویز کردہ اقدامات",

summaryNotDiagnosis:
  "یہ خلاصہ محفوظ شدہ اسکریننگ ڈیٹا پر مبنی ہے اور طبی تشخیص نہیں ہے۔",

noSummaryAvailable:
  "کوئی خلاصہ دستیاب نہیں",

noStoredSummary:
  "اس اسکریننگ کے لیے کوئی محفوظ شدہ خلاصہ دستیاب نہیں ہے۔",

completeRetinalAnalysis:
  "خلاصہ بنانے کے لیے پہلے ریٹینا کی تصویر کا تجزیہ مکمل کریں۔",

downloadDoctorSummary:
  "ڈاکٹر کا خلاصہ ڈاؤن لوڈ کریں",

preparingDownload:
  "ڈاؤن لوڈ تیار کیا جا رہا ہے...",

summaryUnavailable:
  "خلاصہ دستیاب نہیں",

unableToLoadStoredSummary:
  "محفوظ شدہ اسکریننگ خلاصہ لوڈ نہیں کیا جا سکا۔",

downloadUnavailable:
  "ڈاؤن لوڈ دستیاب نہیں",

unableToDownloadSummary:
  "خلاصہ ڈاؤن لوڈ نہیں کیا جا سکا۔",
patientProfile: "مریض کا پروفائل",
loadingPatientDetails:
  "مریض کی معلومات لوڈ ہو رہی ہیں...",
usernameNotAvailable:
  "صارف نام دستیاب نہیں",
viewAiDoctorSummary:
  "AI ڈاکٹر کا خلاصہ دیکھیں",
viewRetinalImages:
  "ریٹینا کی تصاویر دیکھیں",
createPrescription:
  "نسخہ بنائیں",
viewStoredClinicalSummary:
  "محفوظ شدہ طبی اسکریننگ کا خلاصہ دیکھیں",
viewPatientRetinalImages:
  "مریض کی ریٹینا کی تصاویر دیکھیں",
couldNotLoadPatientDetails:
  "مریض کی معلومات لوڈ نہیں ہو سکیں۔",
email: "ای میل",
dateOfBirth: "تاریخ پیدائش",

noResults: "کوئی نتیجہ نہیں",
noPatientFound: "کوئی مریض نہیں ملا",
searchError: "خرابی",
failedToSearchPatient: "مریض تلاش کرنے میں ناکامی ہوئی",

searchPatientSubtitle:
  "صارف نام یا موبائل نمبر کے ذریعے تلاش کریں",
searchPatientPlaceholder:
  "صارف نام یا موبائل نمبر درج کریں",
searching: "تلاش جاری ہے...",
search: "تلاش کریں",

noPatientSelected: "کوئی مریض منتخب نہیں کیا گیا",
searchPatientToViewProfile:
  "پروفائل دیکھنے کے لیے صارف نام یا موبائل نمبر کے ذریعے مریض تلاش کریں۔",
unableToLoadAppointments: "اپائنٹمنٹس لوڈ کرنے میں ناکامی ہوئی",
pleaseTryAgain: "براہ کرم دوبارہ کوشش کریں۔",
unableToUpdateAppointment: "اپائنٹمنٹ اپ ڈیٹ کرنے میں ناکامی ہوئی",
doctorAppointments: "ڈاکٹر کی اپائنٹمنٹس",
doctorAppointmentsDescription:
  "مریضوں کے دوروں کا جائزہ لیں اور اپائنٹمنٹ کے فیصلوں سے آگاہ کریں۔",
noAppointmentsWaiting:
  "جائزے کے لیے کوئی اپائنٹمنٹ موجود نہیں ہے۔",
pending: "زیر التواء",
confirmed: "تصدیق شدہ",
rejected: "مسترد شدہ",
completed: "مکمل شدہ",
confirm: "تصدیق کریں",
reject: "مسترد کریں",
markCompleted: "مکمل شدہ نشان زد کریں",
back: "واپس",
unableToLoadAuditLogs: "آڈٹ لاگز لوڈ کرنے میں ناکامی ہوئی۔",
loadingAuditLogs: "آڈٹ لاگز لوڈ ہو رہے ہیں...",

noAuditActivity: "ابھی تک کوئی آڈٹ سرگرمی ریکارڈ نہیں ہوئی۔",
dateUnavailable: "تاریخ دستیاب نہیں",
recentActivity: "حالیہ سرگرمی",
noRecentActivity: "ابھی تک کوئی حالیہ سرگرمی ریکارڈ نہیں ہوئی۔",
clinicalActivity: "طبی سرگرمی",
doctors: "ڈاکٹرز",
patients: "مریض",
unableToLoadClinicalReports: "کلینیکل رپورٹس لوڈ نہیں ہو سکیں۔",
unableToDownloadReport: "یہ رپورٹ ڈاؤن لوڈ نہیں ہو سکی۔",
loadingClinicalReports: "کلینیکل رپورٹس لوڈ ہو رہی ہیں...",
clinicalReports: "کلینیکل رپورٹس",
viewAllUploadedClinicalReports: "تمام اپ لوڈ شدہ کلینیکل رپورٹس دیکھیں",
noReportsAvailable: "کوئی رپورٹ دستیاب نہیں",
hospitalReportsWillAppearHere: "ہسپتال کی طرف سے اپ لوڈ کی گئی رپورٹس یہاں ظاہر ہوں گی۔",
report: "رپورٹ",
hospitalReport: "ہسپتال کی رپورٹ",
uploadDate: "اپ لوڈ کی تاریخ",
notProvided: "فراہم نہیں کیا گیا",
status: "حیثیت",
download: "ڈاؤن لوڈ",
preparing: "تیاری ہو رہی ہے...",
downloadReport: "رپورٹ ڈاؤن لوڈ کریں",
enterUsernameOrMobile: "صارف نام یا موبائل نمبر درج کریں۔",
failedToSearchPatients: "مریضوں کی تلاش میں ناکامی ہوئی۔",
searchPatientToViewProfileAndReports: "پروفائل دیکھنے اور رپورٹس اپ لوڈ کرنے کے لیے مریض تلاش کریں۔",

reportType: "رپورٹ کی قسم",
clinicalReport: "کلینیکل رپورٹ",
eyeExamination: "آنکھوں کا معائنہ",
bloodReport: "خون کی رپورٹ",
medicalHistory: "طبی تاریخ",
hospitalName: "ہسپتال کا نام",
enterHospitalName: "ہسپتال کا نام درج کریں",
doctorName: "ڈاکٹر کا نام",
enterDoctorName: "ڈاکٹر کا نام درج کریں",
reportDescription: "رپورٹ کی تفصیل",
enterReportDetails: "رپورٹ کی تفصیلات درج کریں...",
selectPdfOrImage: "PDF / تصویر منتخب کریں",
submitReport: "رپورٹ جمع کروائیں",
submitting: "جمع کی جا رہی ہے...",


completeHospitalDoctorDescription: "ہسپتال، ڈاکٹر اور تفصیل کے تمام خانے مکمل کریں۔",
clinicalReportUploadedSuccessfully: "کلینیکل رپورٹ کامیابی سے اپ لوڈ ہو گئی۔",
couldNotUploadClinicalReport: "کلینیکل رپورٹ اپ لوڈ نہیں ہو سکی۔",
uploadFailed: "اپ لوڈ ناکام",
noNewNotifications: "کوئی نئی اطلاعات نہیں ہیں",
cancelAppointment: "اپائنٹمنٹ منسوخ کریں",
appointmentCancelConfirmation:
  "کیا آپ واقعی اپنی اپائنٹمنٹ منسوخ کرنا چاہتے ہیں جو",
keep: "برقرار رکھیں",
appointmentCancelled: "اپائنٹمنٹ منسوخ ہو گئی",
appointmentCancelledMessage:
  "آپ کی اپائنٹمنٹ منسوخ کر دی گئی ہے۔",
unableToCancel: "منسوخ نہیں ہو سکی",
unableToCancelAppointment:
  "اپائنٹمنٹ منسوخ کرتے وقت ایک مسئلہ پیش آیا۔",
medicalConsultation: "طبی مشاورت",
date: "تاریخ",
time: "وقت",
of: "میں سے",
notSet: "متعین نہیں",
appointmentHistory: "اپائنٹمنٹ کی تاریخ",
patientAnalytics: "مریض کا تجزیہ",
screeningActivityDescription:
  "محفوظ ریکارڈز سے آپ کی اسکریننگ اور نگہداشت کی سرگرمی۔",
screenings: "اسکریننگز",
latestScreening: "تازہ ترین اسکریننگ",
noScreeningResult:
  "ابھی تک کوئی اسکریننگ کا نتیجہ دستیاب نہیں۔",
scheduleVisit: "اپنے ڈاکٹر کے ساتھ ملاقات طے کریں",
selectDoctor: "ڈاکٹر منتخب کریں",
selectDoctorError:
  "براہ کرم جاری رکھنے سے پہلے ڈاکٹر منتخب کریں۔",
selectDate: "تاریخ منتخب کریں",
selectDateError:
  "براہ کرم اپائنٹمنٹ کی تاریخ منتخب کریں۔",
selectTime: "وقت منتخب کریں",
selectTimeError:
  "براہ کرم اپائنٹمنٹ کا وقت منتخب کریں۔",
reasonForVisit: "ملاقات کی وجہ",
reasonPlaceholder:
  "اپنی اپائنٹمنٹ کی وجہ بیان کریں...",
reasonRequired: "وجہ درکار ہے",
reasonRequiredMessage:
  "براہ کرم اپنی اپائنٹمنٹ کی وجہ درج کریں۔",
appointmentSummary: "اپائنٹمنٹ کا خلاصہ",
confirmAppointment: "اپائنٹمنٹ کی تصدیق کریں",
appointmentRequested: "اپائنٹمنٹ کی درخواست بھیج دی گئی",
appointmentRequestedMessage:
  "آپ کی اپائنٹمنٹ کی درخواست کامیابی سے جمع ہو گئی ہے۔",
viewAppointments: "اپائنٹمنٹس دیکھیں",
unableToBook: "اپائنٹمنٹ بک نہیں ہو سکی",
unableToBookAppointment:
  "اپائنٹمنٹ بک کرتے وقت کچھ غلط ہو گیا۔",
colorVision: "رنگوں کی بصارت",
visionScreening: "بصارت کی اسکریننگ",
interactiveColorPerceptionScreening:
  "رنگوں کی پہچان کی انٹرایکٹو اسکریننگ۔",

testYourColorVision: "اپنی رنگوں کی بصارت کا ٹیسٹ کریں",
colorVisionTestDescription:
  "آپ کو کئی رنگین پلیٹس دکھائی جائیں گی جن میں اعداد ہوں گے۔ غور سے دیکھیں اور وہ عدد منتخب کریں جو آپ کو نظر آئے۔",

beforeYouStart: "شروع کرنے سے پہلے",

useGoodLighting: "اچھی روشنی استعمال کریں",
useGoodLightingDescription:
  "ٹیسٹ اچھی روشنی والی جگہ پر کریں اور اسکرین کی چمک سے بچیں۔",

keepScreenSteady: "اسکرین کو مستحکم رکھیں",
keepScreenSteadyDescription:
  "ڈیوائس کو آرام دہ فاصلے پر رکھیں اور زوم کرنے سے گریز کریں۔",

lookCarefully: "غور سے دیکھیں",
lookCarefullyDescription:
  "جواب منتخب کرنے سے پہلے ہر پلیٹ کو چند سیکنڈ غور سے دیکھیں۔",

answerHonestly: "ایمانداری سے جواب دیں",
answerHonestlyDescription:
  "وہی عدد منتخب کریں جو آپ واقعی دیکھ سکتے ہیں، بار بار اندازہ لگانے سے گریز کریں۔",

colorVisionEducationalNotice:
  "یہ ایک تعلیمی اسکریننگ ٹول ہے۔ یہ باقاعدہ تشخیصی رنگوں کی بصارت کا ٹیسٹ نہیں ہے۔",

startTest: "ٹیسٹ شروع کریں",

screeningComplete: "اسکریننگ مکمل",
yourResult: "آپ کا نتیجہ",

normalScreeningResult: "نارمل اسکریننگ نتیجہ",
normalScreeningDescription:
  "آپ نے رنگوں کی زیادہ تر پلیٹس درست طور پر شناخت کیں۔",

someDifficultyDetected: "کچھ دشواری کا پتہ چلا",
someDifficultyDescription:
  "کچھ رنگین پلیٹس کی شناخت مشکل تھی۔ اسکریننگ دوبارہ کرنے یا آنکھوں کے ماہر سے نتیجہ پر بات کرنے پر غور کریں۔",

furtherEvaluationRecommended: "مزید جانچ کی سفارش",
furtherEvaluationDescription:
  "کئی رنگین پلیٹس کی شناخت مشکل تھی۔ کسی ماہر سے رنگوں کی بصارت کا باقاعدہ معائنہ مفید ہو سکتا ہے۔",

accuracy: "درستگی",
correct: "درست",
plates: "پلیٹس",

today: "آج",

colorVisionResultNotice:
  "رنگوں کی بصارت کی اسکریننگ کے نتائج کو احتیاط سے سمجھنا چاہیے۔ اگر آپ کو رنگوں کی شناخت میں دشواری ہو تو آنکھوں کے ماہر سے مشورہ کریں۔",

retakeTest: "ٹیسٹ دوبارہ کریں",
backToVisionTests: "بصارت کے ٹیسٹس پر واپس جائیں",

plate: "پلیٹ",
colorPlate: "رنگین پلیٹ",
whatNumberDoYouSee: "آپ کو کون سا عدد نظر آ رہا ہے؟",
selectYourAnswer: "اپنا جواب منتخب کریں",
correctAnswer: "درست",
expectedAnswer: "متوقع جواب ہے",
colorVisionTestTip:
  "پلیٹ کے مرکز کو دیکھیں اور زوم کرنے یا اسکرین سے فاصلہ تبدیل کرنے سے گریز کریں۔",

preparingColorVisionTest: "رنگوں کی بصارت کا ٹیسٹ تیار ہو رہا ہے...",

colorVisionScreeningSubtitle:
  "رنگوں کی بصری ادراک کی انٹرایکٹو اسکریننگ۔",

goodLighting: "اچھی روشنی استعمال کریں",
goodLightingDescription:
  "ٹیسٹ روشن ماحول میں کریں اور اسکرین کی چمک سے بچیں۔",

steadyScreen: "اسکرین کو مستحکم رکھیں",
steadyScreenDescription:
  "اپنے آلے کو آرام دہ فاصلے پر رکھیں اور زوم کرنے سے گریز کریں۔",

normalScreeningResultDescription:
  "آپ نے رنگوں کی بصارت کی زیادہ تر پلیٹس درست طور پر شناخت کیں۔",


someDifficultyDetectedDescription:
  "کچھ رنگین پلیٹس کی شناخت مشکل تھی۔ اسکریننگ دوبارہ کرنے یا آنکھوں کے ماہر سے نتیجہ شیئر کرنے پر غور کریں۔",

furtherEvaluationRecommendedDescription:
  "کئی رنگین پلیٹس کی شناخت مشکل تھی۔ رنگوں کی بصارت کے لیے پیشہ ورانہ معائنہ مددگار ہو سکتا ہے۔",

colorVisionPlate1Description:
  "عام رنگوں کی بصارت رکھنے والے زیادہ تر افراد کو یہ عدد شناخت کرنے کے قابل ہونا چاہیے۔",

colorVisionPlate2Description:
  "مختلف رنگ کے نقطوں سے بنے ہوئے عدد کو شناخت کریں۔",

colorVisionPlate3Description:
  "پلیٹ کے مرکز کو غور سے دیکھیں۔",

colorVisionPlate4Description:
  "مرکز میں موجود دونوں ہندسوں کو شناخت کرنے کی کوشش کریں۔",

colorVisionPlate5Description:
  "دونوں ہندسے دائرے کے اندر واضح طور پر نظر آنے چاہئیں۔",

colorVisionPlate6Description:
  "اپنا نتیجہ دیکھنے سے پہلے آخری عدد کو شناخت کریں۔",
colorVisionSubtitle:
  "رنگوں کی بصارت کی انٹرایکٹو اسکریننگ۔",
none: "کوئی نہیں",
visualAcuity: "بصری تیزی",
visualAcuityScreening: "بصری تیزی کی اسکریننگ",
visualAcuitySubtitle:
  "ہر آنکھ کی بینائی کی وضاحت جانچنے کے لیے انٹرایکٹو اسکریننگ۔",

testYourVisualAcuity:
  "اپنی بصری تیزی کا ٹیسٹ کریں",

visualAcuityTestDescription:
  "آپ مختلف سائز میں دکھائے گئے حروف کو پہچانیں گے۔ اس اسکریننگ میں پہلے ہر آنکھ کو الگ اور پھر دونوں آنکھوں کو ایک ساتھ جانچا جائے گا۔",

visualAcuityLightingTitle:
  "مناسب روشنی استعمال کریں",

visualAcuityLightingDescription:
  "اسکریننگ اچھی روشنی والی جگہ پر کریں اور اسکرین پر روشنی کے انعکاس سے بچیں۔",

visualAcuityDistanceTitle:
  "مناسب فاصلہ برقرار رکھیں",

visualAcuityDistanceDescription:
  "اپنے آلے کو آنکھوں سے تقریباً 40 سینٹی میٹر (16 انچ) کے فاصلے پر رکھیں اور اسکرین کو زوم نہ کریں۔",

visualAcuityGlassesTitle:
  "اپنی معمول کی عینک استعمال کریں",

visualAcuityGlassesDescription:
  "اگر آپ عام طور پر دور کی نظر کے لیے عینک یا کانٹیکٹ لینز استعمال کرتے ہیں تو اسکریننگ کے دوران انہیں استعمال کریں۔",

visualAcuityCoverTitle:
  "ہدایت کے مطابق ایک آنکھ ڈھانپیں",

visualAcuityCoverDescription:
  "جس آنکھ کو ڈھانپنے کے لیے کہا جائے اسے نرمی سے ڈھانپیں اور اس پر دباؤ نہ ڈالیں۔ جس آنکھ کا ٹیسٹ ہو رہا ہو اسے بند یا سکیڑیں نہیں۔",

visualAcuityReadingTitle:
  "ایمانداری سے جواب دیں",

visualAcuityReadingDescription:
  "صرف وہی حروف منتخب کریں جو آپ واقعی پہچان سکتے ہیں۔ اندازہ لگانے یا بار بار جواب تبدیل کرنے سے گریز کریں۔",

visualAcuityEducationalNotice:
  "یہ ایک تعلیمی اسکریننگ ٹول ہے۔ یہ کسی باقاعدہ کلینیکل آنکھوں کے معائنے یا تشخیص کا متبادل نہیں ہے۔",

rightEye: "دائیں آنکھ",
leftEye: "بائیں آنکھ",
bothEyes: "دونوں آنکھیں",

rightEyeInstructionTitle:
  "دائیں آنکھ کا ٹیسٹ",

leftEyeInstructionTitle:
  "بائیں آنکھ کا ٹیسٹ",

bothEyesInstructionTitle:
  "دونوں آنکھوں کا ٹیسٹ",

rightEyeInstructionDescription:
  "اپنی بائیں آنکھ کو نرمی سے ڈھانپیں۔ دائیں آنکھ کھلی رکھیں اور اسکرین پر موجود حروف کو براہ راست دیکھیں۔",

leftEyeInstructionDescription:
  "اپنی دائیں آنکھ کو نرمی سے ڈھانپیں۔ بائیں آنکھ کھلی رکھیں اور اسکرین پر موجود حروف کو براہ راست دیکھیں۔",

bothEyesInstructionDescription:
  "دونوں آنکھیں کھلی رکھیں اور اسکرین پر موجود حروف کو براہ راست دیکھیں۔",

recommendedDistance:
  "تجویز کردہ فاصلہ: تقریباً 40 سینٹی میٹر / 16 انچ",

visualAcuityEyeTip:
  "آلہ کو مستحکم رکھیں، زوم نہ کریں اور اس حصے کے دوران دیکھنے کا فاصلہ ایک جیسا رکھیں۔",

whatLettersDoYouSee:
  "آپ کو کون سے حروف نظر آ رہے ہیں؟",

visualAcuityQuestionDescription:
  "چارٹ کو غور سے دیکھیں اور وہ آپشن منتخب کریں جو آپ کو نظر آنے والے حروف سے مطابقت رکھتا ہے۔",

selectWhatYouSee:
  "جو آپ دیکھ رہے ہیں اسے منتخب کریں",

cannotSee:
  "نظر نہیں آ رہا",

visualAcuityExpectedAnswer:
  "متوقع جواب {answer} ہے۔",

visualAcuityLine:
  "بصری تیزی کی لائن",

lineProgress:
  "لائن {current} از {total}",

eyeResults:
  "آنکھوں کے نتائج",

visualAcuityNormalResult:
  "معمول کی اسکریننگ کا نتیجہ",

visualAcuityNormalDescription:
  "آپ نے اس اسکریننگ کے دوران بصری تیزی کی زیادہ تر لائنوں کو درست طور پر پہچانا۔",

visualAcuityDifficultyResult:
  "کچھ دشواری محسوس ہوئی",

visualAcuityDifficultyDescription:
  "کچھ لائنوں کو پہچاننا مشکل تھا۔ اسکریننگ دوبارہ کرنے یا اپنی بینائی کے بارے میں آنکھوں کے ماہر سے بات کرنے پر غور کریں۔",

visualAcuityFollowupResult:
  "مزید معائنے کی سفارش",

visualAcuityFollowupDescription:
  "کئی بصری تیزی کی لائنوں کو پہچاننا مشکل تھا۔ آنکھوں کا باقاعدہ پیشہ ورانہ معائنہ مفید ہو سکتا ہے۔",

visualAcuityResultNotice:
  "یہ اسکریننگ طبی 20/20 یا Snellen بصری تیزی کی درست پیمائش نہیں کرتی۔ اگر آپ کو واضح طور پر دیکھنے میں دشواری ہو تو آنکھوں کے ماہر سے مشورہ کریں۔",

visualAcuityTestTip:
  "آلہ کو اسی فاصلے پر رکھیں اور زوم کرنے یا دیکھنے کی پوزیشن تبدیل کرنے سے گریز کریں۔",

unableToSaveScreening:
  "اسکریننگ محفوظ نہیں ہو سکی",


    visionTestsSubtitle: "بینائی کے چیک مکمل کریں اور اپنے نتائج کو ٹریک کریں۔", 
    beforeYouBegin: "شروع کرنے سے پہلے", 
    visionTestsNotice: "یہ ٹیسٹ اسکریننگ اور مانیٹرنگ کے ٹولز ہیں۔ یہ پیشہ ورانہ آنکھوں کے معائنے کی جگہ نہیں لیتے ہیں۔", 
    availableTests: "دستیاب ٹیسٹ", 
    visualAcuityDescription: "چیک کریں کہ آپ مختلف سائز میں کتنی واضح طور پر حروف اور علامات دیکھ سکتے ہیں۔", 
    visualAcuityDuration: "تقریباً 2 سے 3 منٹ", 
    amslerGrid: "ایمزلر گرڈ", 
    amslerGridDescription: "تحریف کے علاقوں، غائب لائنوں، یا مرکزی بینائی میں تبدیلیوں کی جانچ کریں۔", 
    amslerGridDuration: "تقریباً 1 سے 2 منٹ", 
    colorVisionDescription: "عام رنگوں کے نمونوں میں تمیز کرنے کی اپنی صلاحیت کی جانچ کریں۔", 
    colorVisionDuration: "تقریباً 2 منٹ", 
    visionTestsFooter: "آپ کے ٹیسٹ کے نتائج آپ کی آنکھوں کی صحت سے متعلق دیگر معلومات کے ساتھ دیکھے جا سکتے ہیں۔",
    amslerCheckCentralVision: "اپنی مرکزی بینائی کی جانچ کریں", 
    amslerDescription: "گرڈ کے مرکز کو دیکھیں اور چیک کریں کہ آیا کوئی لکیریں لہراتی، ٹوٹی ہوئی، غائب، دندلائی ہوئی یا بگڑی ہوئی نظر آتی ہیں۔", 
    amslerUseReadingGlasses: "اپنے معمول کے پڑھنے کے چشمے استعمال کریں", 
    amslerUseReadingGlassesDescription: "اگر آپ عام طور پر قریب سے دیکھنے کے لیے عینک استعمال کرتے ہیں، تو ٹیسٹ کے دوران انہیں پہنیں۔", 
    amslerTestOneEye: "ایک وقت میں ایک آنکھ کا ٹیسٹ کریں", 
    amslerTestOneEyeDescription: "بغیر دباؤ ڈالے ایک آنکھ کو ڈھانپیں۔ پہلے اپنی دائیں آنکھ کا ٹیسٹ کریں، پھر بائیں آنکھ کا۔", 
    amslerKeepScreenComfortable: "اسکرین کو آرام دہ رکھیں", 
    amslerKeepScreenComfortableDescription: "اپنے آلے کو پڑھنے کے عام فاصلے پر رکھیں اور اس فاصلے کو مستقل رکھیں۔", 
    amslerMarkUnusualAreas: "غیر معمولی علاقوں کو نشان زد کریں", 
    amslerMarkUnusualAreasDescription: "گرڈ کے کسی بھی ایسے علاقے کو ٹیپ کریں جو لہراتا، غائب، دھندلا، ٹوٹا ہوا یا بگڑا ہوا دکھائی دے۔", 
    amslerScreeningNotice: "یہ ایک اسکریننگ اور خود نگرانی کا ٹول ہے۔ یہ پیشہ ورانہ آنکھوں کے معائنے کی جگہ نہیں لیتا۔", 
    marked: "نشان زد", 
    amslerFocusCenter: "مرکزی نقطہ پر توجہ مرکوز کریں", 
    amslerDoesGridLookNormal: "کیا گرڈ نارمل لگتا ہے؟", 
    amslerTapDistortedAreas: "مرکز کی طرف دیکھتے رہیں۔ ایسے علاقوں کو ٹیپ کریں جو لہراتے، ٹوٹے ہوئے، غائب یا بگڑے ہوئے نظر آتے ہیں۔", 
    amslerKeepGazeCenter: "آس پاس کی لائنوں کی جانچ کرتے وقت اپنی نظر کو مرکزی نقطہ پر رکھیں۔", 
    clearMarks: "نشانات صاف کریں", 
    testLeftEye: "بائیں آنکھ کا ٹیسٹ کریں", 
    finishTest: "ٹیسٹ ختم کریں", 
    amslerRightEyeCompleteHint: "جب آپ دائیں آنکھ کی جانچ مکمل کر لیں، تو بائیں آنکھ کی طرف بڑھیں۔", 
    amslerNoAreasMarked: "کوئی علاقہ نشان زد نہیں کیا گیا", 
    amslerNoAreasDescription: "آپ نے اس اسکریننگ کے دوران کسی ایسے علاقے کی نشاندہی نہیں کی جو بگڑا ہوا یا غیر معمولی دکھائی دے۔", 
    amslerMinorChanges: "معمولی تبدیلیوں کی اطلاع دی گئی", 
    amslerMinorChangesDescription: "آپ نے کم تعداد میں ایسے علاقوں کو نشان زد کیا جو غیر معمولی دکھائی دیے۔ ٹیسٹ کو احتیاط سے دہرائیں اور کسی بھی تبدیلی پر نظر رکھیں۔", 
    amslerFollowUpRecommended: "فالو اپ کی سفارش کی جاتی ہے", 
    amslerFollowUpDescription: "آپ نے کئی ایسے علاقوں کو نشان زد کیا جو بگڑے ہوئے یا غیر معمولی دکھائی دیے ہیں۔ کسی ماہر امراض چشم سے اس نتیجے پر تبادلہ خیال کرنے پر غور کریں۔", 
    amslerResultNotice: "اگر سیدھی لکیریں بگڑی ہوئی، ٹوٹی ہوئی، غائب یا لہراتی دکھائی دیں، تو مزید جانچ کے لیے کسی ماہر امراض چشم سے رابطہ کریں۔",
  historyRecords: "آپ کے ریکارڈز",
historySubtitle:
  "اپنی سابقہ رپورٹس اور AI پیش گوئیوں کا جائزہ لیں۔",
loadingHistory: "آپ کی تاریخ لوڈ ہو رہی ہے",
retrievingHistory:
  "آپ کے سابقہ ریکارڈز حاصل کیے جا رہے ہیں...",
medicalReport: "طبی رپورٹ",
medicalRecord: "طبی ریکارڈ",
recent: "حالیہ",
processing: "زیرِ عمل",
openRecord: "کھولیں",
viewResult: "نتیجہ دیکھیں",
noHistoryYet: "ابھی کوئی تاریخ موجود نہیں",
historyEmptyDescription:
  "آپ کی اپ لوڈ کی گئی ریٹینا اسکینز، رپورٹس اور AI پیش گوئیاں EyeCare AI استعمال کرنا شروع کرنے کے بعد یہاں ظاہر ہوں گی۔",
uploadScan: "اسکین اپ لوڈ کریں",

manageAccount: "اپنے EyeCare AI اکاؤنٹ کا انتظام کریں",
personalInformation: "ذاتی معلومات",

male: "مرد",
female: "خاتون",
preferNotToSay: "بتانا پسند نہیں",
transgender: "ٹرانس جینڈر",

automaticallyCalculated: "خودکار طور پر شمار کیا گیا",
editProfile: "پروفائل میں ترمیم کریں",
cancelEditing: "ترمیم منسوخ کریں",
saveChanges: "تبدیلیاں محفوظ کریں",

profileUpdatedSuccessfully: "پروفائل کامیابی سے اپ ڈیٹ ہو گیا۔",

failedToLoadProfile: "پروفائل لوڈ نہیں ہو سکا",
failedToUpdateProfile: "پروفائل اپ ڈیٹ نہیں ہو سکا",
screeningConsent: "اسکریننگ کی اجازت",
screeningConsentDescription:
  "اس اکاؤنٹ کو نگہداشت اور تجزیات کے لیے ریٹینل اسکریننگ کے نتائج محفوظ کرنے کی اجازت دیں۔",

on: "آن",
off: "آف",
consentUnavailable: "اجازت دستیاب نہیں",
unableToUpdateScreeningConsent:
  "اسکریننگ کی اجازت اپ ڈیٹ نہیں ہو سکی۔",
logOut: "لاگ آؤٹ",
logoutConfirmation:
  "کیا آپ واقعی اپنے اکاؤنٹ سے لاگ آؤٹ کرنا چاہتے ہیں؟",

loadingProfile: "آپ کا پروفائل لوڈ ہو رہا ہے...",
securePatientWorkspace: "EyeCare AI • محفوظ مریض ورک اسپیس",
enterFirstName: "پہلا نام درج کریں",
enterLastName: "آخری نام درج کریں",
enterUsername: "صارف نام درج کریں",
enterEmail: "ای میل درج کریں",
enterMobileNumber: "موبائل نمبر درج کریں",
usernamePlaceholder: "صارف نام",
user: "صارف",
unableToUpdateConsent: "اسکریننگ کی اجازت اپ ڈیٹ نہیں ہو سکی۔",
bloodGroup: "بلڈ گروپ",
enterBloodGroup: "بلڈ گروپ درج کریں",
address: "پتہ",
enterAddress: "پتہ درج کریں",
eyeCareAISecureWorkspace: "EyeCare AI • محفوظ مریض ورک اسپیس",
permissionRequired: "اجازت درکار ہے",
photoLibraryPermission: "براہ کرم اپنی فوٹو لائبریری تک رسائی کی اجازت دیں۔",
unableToSelectRetinalImage: "ریٹینل تصویر منتخب نہیں ہو سکی۔",
unableToSelectDocument: "دستاویز منتخب نہیں ہو سکی۔",
noFileSelected: "کوئی فائل منتخب نہیں کی گئی",
pleaseSelectFileFirst: "براہ کرم پہلے ایک فائل منتخب کریں۔",
imageQualityTooLow: "تصویر کا معیار بہت کم ہے",
chooseClearerRetinalImage: "براہ کرم زیادہ واضح ریٹینل تصویر منتخب کریں۔",
uploadSuccessful: "اپ لوڈ کامیاب",
predictionIdNotReturned: "آپ کی فائل اپ لوڈ ہو گئی، لیکن پریڈکشن ID موصول نہیں ہوئی۔",
failedToUploadFile: "فائل اپ لوڈ نہیں ہو سکی۔",
uploadReports: "رپورٹس اپ لوڈ کریں",
uploadReportsDescription: "تجزیے کے لیے اپنی طبی رپورٹس یا ریٹینل اسکینز اپ لوڈ کریں۔",
supportedUploadFiles: "ریٹینل تصاویر، PDF رپورٹس اور طبی دستاویزات سپورٹ کی جاتی ہیں۔",
retinalFundusImage: "ریٹینل فنڈس تصویر",
uploadRetinalScan: "ریٹینل اسکین اپ لوڈ کریں",
laboratoryReport: "لیبارٹری رپورٹ",
uploadLaboratoryDocument: "لیبارٹری دستاویز اپ لوڈ کریں",
prescription: "نسخہ",
uploadDoctorPrescription: "ڈاکٹر کا نسخہ اپ لوڈ کریں",
uploadHospitalReport: "ہسپتال کی رپورٹ اپ لوڈ کریں",
selectedFile: "منتخب فائل",
removeSelectedFile: "منتخب فائل ہٹائیں",
uploading: "اپ لوڈ ہو رہا ہے...",
uploadSelectedFile: "منتخب فائل اپ لوڈ کریں",
medicalFilesSecure: "آپ کی طبی فائلیں محفوظ طریقے سے ہینڈل کی جاتی ہیں۔",
aiAnalysisResult: "AI تجزیاتی نتیجہ",
yourRetinalAnalysisProcessed: "آپ کے ریٹینا کے تجزیے پر کارروائی مکمل ہو گئی ہے۔",
analyzingResults: "نتائج کا تجزیہ کیا جا رہا ہے",
pleaseWaitAiAnalysisLoaded: "براہ کرم انتظار کریں، آپ کا AI تجزیہ لوڈ ہو رہا ہے۔",
couldNotLoadResult: "نتیجہ لوڈ نہیں ہو سکا۔",
noAnalysisAvailable: "کوئی تجزیہ دستیاب نہیں",
uploadRetinalImageToGenerate: "AI تشخیصی نتائج حاصل کرنے کے لیے ریٹینا کی تصویر اپ لوڈ کریں۔",
uploadAScan: "اسکین اپ لوڈ کریں",
aiDiagnosis: "AI تشخیص",
unknown: "نامعلوم",
predictionConfidence: "پیش گوئی کا اعتماد",
aiModelConfidence: "اس نتیجے پر AI ماڈل کا اعتماد",
noClinicalFindings: "کوئی طبی نتائج فراہم نہیں کیے گئے۔",
recommendations: "سفارشات",
noRecommendations: "کوئی سفارشات فراہم نہیں کی گئیں۔",
comingSoon: "جلد دستیاب ہوگا",
reportDownloadBackendUnavailable: "رپورٹ ڈاؤن لوڈ کی سہولت بیک اینڈ اینڈ پوائنٹ دستیاب ہونے پر منسلک کی جائے گی۔",
backToDashboard: "ڈیش بورڈ پر واپس جائیں",
confidence: "اعتماد",
riskLevel: "خطرے کی سطح",
  viewPrescriptionsIssuedByDoctors:
    "اپنے ڈاکٹروں کی جانب سے جاری کردہ نسخے دیکھیں",
  loadingPrescriptions: "نسخے لوڈ ہو رہے ہیں...",
  unableToLoadPrescriptions:
    "نسخے لوڈ نہیں کیے جا سکے۔",
  dateNotAvailable: "تاریخ دستیاب نہیں",
  noPrescriptionsYet: "ابھی کوئی نسخہ موجود نہیں",
  prescriptionsWillAppearHere:
    "جب ڈاکٹر آپ کے لیے نسخہ جاری کرے گا تو وہ یہاں ظاہر ہوگا۔",
  yourPrescriptions: "آپ کے نسخے",
  
  medication: "دوا",
  noMedicationDetailsProvided:
    "دوا کی تفصیلات فراہم نہیں کی گئیں۔",
  instructions: "ہدایات",
  noInstructionsProvided:
    "کوئی ہدایات فراہم نہیں کی گئیں۔",
  goBack: "واپس جائیں",
  close: "بند کریں",
  noConnectedDoctors: "کوئی منسلک ڈاکٹر نہیں",
  openMyDoctors: "درخواست بھیجنے کے لیے میرے ڈاکٹرز کھولیں۔",
  selectDateFirst: "دستیاب اوقات دیکھنے کے لیے تاریخ منتخب کریں۔",
  noAvailability: "اس تاریخ کے لیے کوئی وقت دستیاب نہیں ہے۔",
  manageConnections: "کنکشنز کا انتظام کریں",
  connectionRequired: "کنکشن ضروری ہے",
  acceptConnectionBeforeClinicalDetails: "طبی تفصیلات دیکھنے سے پہلے مریض اور ڈاکٹر کا کنکشن قبول کریں۔",
  specialization: "تخصص",
  hospitalClinic: "ہسپتال / کلینک",
  pmdcNumber: "PMDC نمبر",
  doctorFieldsRequired: "براہ کرم تخصص، ہسپتال/کلینک اور PMDC نمبر مکمل کریں۔",
  professionalInformation: "پیشہ ورانہ معلومات",
  licenseNumber: "PMDC نمبر",
  experience: "تجربہ",
  doctorProfile: "ڈاکٹر پروفائل",
  myDoctors: "میرے ڈاکٹرز",
    manageDoctorsDesc: "موصولہ معالجین اور کیئر ٹیم کا انتظام کریں۔",
    messagesDesc: "موصولہ ڈاکٹرز کے ساتھ محفوظ طریقے سے چیٹ کریں۔",
    notificationsDesc: "ملاقاتوں اور دیگر معلومات سے متعلق تازہ معلومات دیکھیں۔",
    myAnalysis: "میرا تجزیہ",
    myAnalysisDesc: "اپنی محفوظ شدہ اسکریننگ کے رجحانات دیکھیں۔",
myDoctorsDescription: "موصولہ معالجین اور کیئر ٹیم کا انتظام کریں",
    messagesDescription: "موصولہ ڈاکٹرز کے ساتھ محفوظ طریقے سے چیٹ کریں",
    startSecureConversation: "محفوظ گفتگو شروع کریں",
    loadingMessages: "پیغامات لوڈ ہو رہے ہیں...",
unableToLoadMessages: "پیغامات لوڈ نہیں کیے جا سکے۔",
noMessagesYet: "ابھی کوئی پیغام نہیں",
secureCareChat: "محفوظ طبی گفتگو",
acceptedConnectionsOnly:
  "یہاں صرف منظور شدہ کنکشنز ظاہر ہوتے ہیں۔",
noConversationsYet: "ابھی کوئی گفتگو نہیں",
acceptConnectionToStartConversation:
  "محفوظ گفتگو شروع کرنے کے لیے ڈاکٹر اور مریض کا کنکشن قبول کریں۔",
openConversationWith: "گفتگو کھولیں",
myPatients: "میرے مریض",
connectedClinicians: "منسلک طبی ماہرین",
connectedPatients: "منسلک مریض",
careDirectory: "کیئر ڈائریکٹری",

connectWithClinician:
  "نگہداشت بک کرنے سے پہلے کسی طبی ماہر سے منسلک ہوں۔",

manageApprovedPatients:
  "ان مریضوں کا انتظام کریں جنہوں نے طبی رسائی کی منظوری دی ہے۔",

searchDoctorsPlaceholder:
  "نام یا تخصص کے ذریعے ڈاکٹر تلاش کریں",

searchPatientsPlaceholder:
  "نام کے ذریعے مریض تلاش کریں",

searchDirectory: "ڈائریکٹری تلاش کریں",

connected: "منسلک",
noActiveConnections:
  "ابھی کوئی فعال کنکشن موجود نہیں۔",

incomingRequests: "موصولہ درخواستیں",
pendingConnectionRequest:
  "زیر التواء کنکشن درخواست",

accept: "قبول کریں",

pendingSentRequests:
  "بھیجی گئی زیر التواء درخواستیں",

waitingForApproval:
  "منظوری کا انتظار ہے",

directoryResults: "ڈائریکٹری کے نتائج",

connect: "منسلک ہوں",
requestNotSent: "درخواست نہیں بھیجی گئی",
connectionCouldNotBeRequested:
  "یہ کنکشن درخواست نہیں بھیجی جا سکی۔",

actionUnavailable: "کارروائی دستیاب نہیں",
requestTryAgain:
  "براہ کرم دوبارہ کوشش کریں۔",

unableToLoadConnections:
  "کنکشنز لوڈ نہیں کیے جا سکے۔",

unableToSearchDirectory:
  "ڈائریکٹری میں تلاش نہیں کی جا سکی۔",

    patientDashboardSubtitle:
      "آپ کی آنکھوں کی صحت اور ذیابیطس کی دیکھ بھال کا جامع ڈیش بورڈ۔",
    healthOverview: "صحت کا جائزہ",
    eyeHealth: "آنکھ کی صحت",
    predictions: "پیش گوئیاں",
    latestScreeningResult: "تازہ ترین اسکریننگ کا نتیجہ",
    stage: "مرحلہ",
    newRetinalScan: "نئی ریٹینل اسکین",
    newRetinalScanDescription:
      "ذیابیطس ریٹینوپیتھی کا تجزیہ فوری طور پر حاصل کرنے کے لیے آنکھ کا نیا اسکین اپ لوڈ کریں۔",
    quickActionsAndFeatures: "فوری اقدامات اور خصوصیات",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

const LANGUAGE_STORAGE_KEY = "dr_healthcare_language";

export type TextDirection = "ltr" | "rtl";

interface LanguageContextValue {
  language: Language;
  direction: TextDirection;
  isRTL: boolean;
  setLanguage: (nextLanguage: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);

  const direction: TextDirection = language === "ur" ? "rtl" : "ltr";
  const isRTL = direction === "rtl";

  useEffect(() => {
    let mounted = true;

    const loadSavedLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(
          LANGUAGE_STORAGE_KEY
        );

        if (
          mounted &&
          (savedLanguage === "en" || savedLanguage === "ur")
        ) {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        console.error("Failed to load saved language:", error);
      } finally {
        if (mounted) {
          setIsLanguageLoaded(true);
        }
      }
    };

    loadSavedLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
  }, [language, direction]);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);

    try {
      await AsyncStorage.setItem(
        LANGUAGE_STORAGE_KEY,
        nextLanguage
      );
    } catch (error) {
      console.error("Failed to save selected language:", error);
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const nextLanguage: Language = language === "en" ? "ur" : "en";
    await setLanguage(nextLanguage);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? translations.en[key] ?? key;
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      isRTL,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, direction, isRTL, setLanguage, toggleLanguage, t]
  );

  if (!isLanguageLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}

export type { Language, TranslationKey };
