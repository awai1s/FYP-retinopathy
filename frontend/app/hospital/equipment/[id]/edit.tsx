import React from "react";
import { useLocalSearchParams } from "expo-router";
import EquipmentForm from "../../../../components/hospital/EquipmentForm";

export default function EditEquipmentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <EquipmentForm equipmentId={String(id || "")} />;
}
