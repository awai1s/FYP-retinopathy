import { Alert } from "../../services/alert";
import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";

import { uploadHospitalReport } from "../../services/hospital";
import { useLanguage } from "../../services/i18n";

import AppShell from "../../design/components/AppShell";
import Card from "../../design/components/card";
import IconContainer from "../../design/components/IconContainer";
import Button from "../../design/components/Button";
import colors from "../../design/tokens/colors";
import spacing from "../../design/tokens/spacing";
import typography from "../../design/tokens/typography";
import radius from "../../design/tokens/radius";

import { useThemeRefresh } from "../../providers/AppThemeProvider";
export default function HospitalUploadReportScreen() {
  useThemeRefresh();
  const { t } = useLanguage();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  const [reportType, setReportType] = useState("Clinical Report");
  const [hospital, setHospital] = useState("");
  const [doctor, setDoctor] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled) {
      setSelectedFile(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!hospital.trim() || !doctor.trim() || !description.trim()) {
      Alert.alert(
        t("missingInformation") || "Missing Information",
        t("completeHospitalDoctorDescription") || "Please complete hospital name, clinician name, and report details."
      );
      return;
    }

    try {
      setSubmitting(true);
      await uploadHospitalReport({
        reportType,
        hospitalName: hospital.trim(),
        doctorName: doctor.trim(),
        description: description.trim(),
        patientId: patientId ? String(patientId) : undefined,
        file: selectedFile
          ? {
              uri: selectedFile.uri,
              name: selectedFile.name,
              mimeType: selectedFile.mimeType,
            }
          : null,
      });

      Alert.alert(
        t("success") || "Upload Complete",
        t("clinicalReportUploadedSuccessfully") || "Clinical report uploaded successfully."
      );
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Hospital report upload failed:", error);
      Alert.alert(
        t("uploadFailed") || "Upload Failed",
        error?.message || t("couldNotUploadClinicalReport") || "Could not upload clinical report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell role="Hospital" title={t("uploadClinicalReport") || "Upload Clinical Report"} showBack onBackPress={() => router.back()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>HOSPITAL RECORDS</Text>
          <Text style={styles.title}>{t("uploadClinicalReport") || "Upload Diagnostic Report"}</Text>
          <Text style={styles.subtitle}>Upload clinical lab results, eye exam summaries, or medical histories.</Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>{t("reportType") || "Report Classification"}</Text>
          <View style={styles.pickerBox}>
            <Picker
              style={styles.picker}
              selectedValue={reportType}
              onValueChange={(val) => setReportType(val)}
            >
              <Picker.Item label={t("clinicalReport") || "Clinical Report"} value="Clinical Report" />
              <Picker.Item label={t("eyeExamination") || "Eye Examination"} value="Eye Examination" />
              <Picker.Item label={t("bloodReport") || "Blood Report / HbA1c"} value="Blood Report" />
              <Picker.Item label={t("medicalHistory") || "Medical History Summary"} value="Medical History" />
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>{t("hospitalName") || "Hospital / Center Name"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t("enterHospitalName") || "e.g. St. Jude Eye Institute"}
            placeholderTextColor={colors.textMuted}
            value={hospital}
            onChangeText={setHospital}
          />

          <Text style={styles.fieldLabel}>{t("doctorName") || "Attending Physician"}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t("enterDoctorName") || "e.g. Dr. Sarah Jenkins"}
            placeholderTextColor={colors.textMuted}
            value={doctor}
            onChangeText={setDoctor}
          />

          <Text style={styles.fieldLabel}>{t("reportDescription") || "Clinical Findings & Notes"}</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            multiline
            numberOfLines={4}
            placeholder={t("enterReportDetails") || "Enter clinical diagnostic summary, lab values, or fundus notes..."}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Attachment Document</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePickFile} style={styles.filePickerBtn}>
            <IconContainer name="document-attach-outline" size={22} color={colors.teal800} backgroundColor={colors.teal100} />
            <Text style={styles.filePickerText} numberOfLines={1}>
              {selectedFile?.name || (t("selectPdfOrImage") || "Select PDF Report or Retinal Image")}
            </Text>
          </TouchableOpacity>

          <Button
            title={submitting ? (t("submitting") || "Uploading...") : (t("submitReport") || "Submit Clinical Report")}
            icon="cloud-upload-outline"
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl + 40,
  },
  headerGroup: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.surface,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerBox: {
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  picker: {
    color: colors.textPrimary,
  },
  textInput: {
    backgroundColor: colors.pageBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  multilineInput: {
    minHeight: 100,
  },
  filePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  filePickerText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.teal900,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
