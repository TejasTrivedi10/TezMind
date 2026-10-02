/**
 * EditorUI — Phase 2 placeholder.
 * Will be the main canvas + panels component.
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { HostBridge } from '@tezmind/core';

export interface EditorUIProps {
  bridge: HostBridge;
  projectId: string;
}

export function EditorUI({ projectId }: EditorUIProps) {
  return (
    <View>
      <Text>Editor UI — Phase 2 (project: {projectId})</Text>
    </View>
  );
}
