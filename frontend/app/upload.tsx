import { Alert } from "../services/alert";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import UploadOptionCard from "../components/patient/UploadOptionCard";
import { uploadPatientReport } from "../services/patient";
import { evaluateImageQuality } from "../services/vision";
import { appendUploadFile } from "../services/uploadFile";
import { useLanguage } from "../services/i18n";

import AppShell from "../design/components/AppShell";
import Card from "../design/components/card";
import IconContainer from "../design/components/IconContainer";
import Button from "../design/components/Button";
import colors from "../design/tokens/colors";
import spacing from "../design/tokens/spacing";
import typography from "../design/tokens/typography";
import radius from "../design/tokens/radius";

import { useThemeRefresh } from "../providers/AppThemeProvider";
type UploadType = "retinal_image" | "document";

interface SelectedFile {
  uri: string;
  type: string;
  name: string;
  uploadType: UploadType;
  reportType: string;
  description: string;
}

export default function UploadScreen() {
  useThemeRefresh();
  const { t } = useLanguage();

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickRetinalImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t("permissionRequired") || "Permission Required",
            t("photoLibraryPermission") || "Photo library access is needed to select retinal images."
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setSelectedFile({
        uri: file.uri,
        type: file.mimeType || "image/jpeg",
        name: file.fileName || "retinal-fundus-image.jpg",
        uploadType: "retinal_image",
        reportType: "Retinal Screening",
        description: "Retinal fundus image submitted by patient",
      });
    } catch (error) {
      console.error("IMAGE PICKER ERROR:", error);
      Alert.alert(
        t("error") || "Error",
        t("unableToSelectRetinalImage") || "Unable to select retinal image."
      );
    }
  };

  const pickDocument = async (
    reportType: string,
    description: string
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setSelectedFile({
        uri: file.uri,
        type: file.mimeType || "application/pdf",
        name: file.name,
        uploadType: "document",
        reportType,
        description,
      });
    } catch (error) {
      console.error("DOCUMENT PICKER ERROR:", error);
      Alert.alert(
        t("error") || "Error",
        t("unableToSelectDocument") || "Unable to select document."
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert(
        t("noFileSelected") || "No File Selected",
        t("pleaseSelectFileFirst") || "Please select a file first."
      );
      return;
    }

    setUploading(true);

    try {
      // Phase 7: image-quality screening is only for retinal-screening images.
      // A photo of a prescription/lab document must remain a normal document.
      if (selectedFile.uploadType === "retinal_image") {
        const quality = await evaluateImageQuality(selectedFile);

        if (!quality.accepted) {
          Alert.alert(
            t("imageQualityTooLow") || "Image Quality Issue",
            quality.message ||
              t("chooseClearerRetinalImage") ||
              "Please choose a clearer retinal fundus image."
          );
          return;
        }
      }

      const formData = new FormData();
      formData.append("reportType", selectedFile.reportType);
      formData.append("description", selectedFile.description);
      formData.append("uploadType", selectedFile.uploadType);
      await appendUploadFile(formData, "file", selectedFile, "patient-upload");

      const response = await uploadPatientReport(formData);

      if (selectedFile.uploadType === "retinal_image") {
        const predictionId = response.predictionId;

        if (!predictionId) {
          throw new Error(
            "The retinal image was uploaded but no screening prediction ID was returned."
          );
        }

        setSelectedFile(null);
        router.push({
          pathname: "/result",
          params: { predictionId },
        });
        return;
      }

      if (!response.reportId) {
        throw new Error(
          "The document was uploaded but no report ID was returned."
        );
      }

      setSelectedFile(null);
      Alert.alert(
        t("uploadSuccessful") || "Upload Complete",
        response.message || "Document uploaded successfully."
      );
    } catch (error: any) {
      console.error("UPLOAD ERROR =", error);
      Alert.alert(
        t("uploadFailed") || "Upload Failed",
        error?.message || t("failedToUploadFile") || "Failed to upload file."
      );
    } finally {
      setUploading(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  const isRetinalSelection = selectedFile?.uploadType === "retinal_image";

  return (
    <AppShell
      role="Patient"
      title={t("uploadReports") || "Upload Screening"}
      showBack
      onBackPress={() => router.back()}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>AI DIAGNOSTICS</Text>
          <Text style={styles.title}>
            {t("uploadReports") || "Upload Retinal Screening"}
          </Text>
          <Text style={styles.subtitle}>
            {t("uploadReportsDescription") ||
              "Upload high-resolution retinal fundus images for automated Diabetic Retinopathy grading."}
          </Text>
        </View>

        <Card variant="accent" style={styles.infoBanner}>
          <View style={styles.infoRow}>
            <IconContainer
              name="information-circle-outline"
              size={22}
              color={colors.teal900}
              backgroundColor={colors.surface}
            />
            <Text style={styles.infoText}>
              {t("supportedUploadFiles") ||
                "Retinal JPEG/PNG images create a screening record. PDF or other clinical documents remain document records."}
            </Text>
          </View>
        </Card>

        <View style={styles.optionsList}>
            <UploadOptionCard
              onPress={pickRetinalImage}
              title={t("retinalFundusImage") || "Retinal Fundus Image"}
              subtitle={
                selectedFile?.uploadType === "retinal_image"
                  ? selectedFile.name
                  : t("uploadRetinalScan") || "Select camera scan or gallery image"
              }
              icon="eye"
              color={colors.teal800}
            />

            <UploadOptionCard
              onPress={() =>
              pickDocument(
                "Laboratory Report",
                "Laboratory report uploaded by patient"
              )
            }
              title={t("laboratoryReport") || "Laboratory Report"}
              subtitle={
                selectedFile?.reportType === "Laboratory Report"
                  ? selectedFile.name
                  : t("uploadLaboratoryDocument") || "Select lab report document"
              }
              icon="flask"
              color={colors.info}
            />

            <UploadOptionCard
              onPress={() =>
              pickDocument(
                "Prescription",
                "Prescription document uploaded by patient"
              )
            }
              title={t("prescription") || "Prescription Document"}
              subtitle={
                selectedFile?.reportType === "Prescription"
                  ? selectedFile.name
                  : t("uploadDoctorPrescription") || "Upload clinician prescription file"
              }
              icon="document-text"
              color={colors.warning}
            />

            <UploadOptionCard
              onPress={() =>
              pickDocument(
                "Clinical Report",
                "Hospital clinical record uploaded by patient"
              )
            }
              title={t("clinicalReport") || "Hospital Clinical Record"}
              subtitle={
                selectedFile?.reportType === "Clinical Report"
                  ? selectedFile.name
                  : t("uploadHospitalReport") || "Upload hospital summary record"
              }
              icon="medical"
              color={colors.teal900}
            />
        </View>

        {selectedFile && (
          <Card variant="elevated" style={styles.selectedCard}>
            <View style={styles.selectedRow}>
              <IconContainer
                name={isRetinalSelection ? "eye-outline" : "document-attach-outline"}
                size={24}
                color={colors.teal800}
                backgroundColor={colors.teal100}
              />
              <View style={styles.selectedMain}>
                <Text style={styles.selectedLabel}>
                  {isRetinalSelection
                    ? "SELECTED RETINAL SCREENING IMAGE"
                    : "SELECTED MEDICAL DOCUMENT"}
                </Text>
                <Text style={styles.selectedName} numberOfLines={2}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.selectedType}>{selectedFile.reportType}</Text>
              </View>
              <TouchableOpacity
                onPress={clearSelectedFile}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel="Remove file"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <Button
          title={
            uploading
              ? isRetinalSelection
                ? "Submitting Screening..."
                : t("uploading") || "Uploading..."
              : isRetinalSelection
                ? "Submit Retinal Screening"
                : t("uploadSelectedFile") || "Upload Selected Document"
          }
          icon={isRetinalSelection ? "eye-outline" : "cloud-upload-outline"}
          onPress={handleUpload}
          disabled={!selectedFile || uploading}
          loading={uploading}
          style={styles.submitBtn}
        />

        <View style={styles.securityFooter}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.securityText}>
            {t("medicalFilesSecure") ||
              "Your medical files are securely transmitted and stored."}
          </Text>
        </View>
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
  infoBanner: {
    backgroundColor: colors.teal50,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.md,
    lineHeight: 18,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectedCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.teal500,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedMain: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  selectedLabel: {
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    color: colors.teal800,
    letterSpacing: 0.5,
  },
  selectedName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  selectedType: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.pageBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  securityFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    gap: 6,
  },
  securityText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
