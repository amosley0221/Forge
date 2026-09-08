import { Capacitor, registerPlugin } from '@capacitor/core';
import { modelFileUri } from './storage.js';

/**
 * Models live in app-private storage, which no other app can see. This copies
 * one into the phone's public Downloads folder so it turns up in Chrome's
 * downloads list and the Files app — the difference between "it exported
 * somewhere" and "I can find it".
 */
export interface ForgeFilesPlugin {
  saveToDownloads(options: { sourcePath: string; name: string }): Promise<{
    uri: string;
    name: string;
  }>;
  saveBase64ToDownloads(options: { base64: string; name: string; mimeType?: string }): Promise<{
    uri: string;
    name: string;
  }>;
}

const Native = registerPlugin<ForgeFilesPlugin>('ForgeFiles');

export const canSaveToDownloads = () => Capacitor.isNativePlatform();

/** Save bytes we hold in memory — an export zip, say — into Downloads. */
export async function saveBlobToDownloads(blob: Blob, name: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Saving to Downloads works in the installed Android app.');
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the export'));
    reader.readAsDataURL(blob);
  });
  const { uri } = await Native.saveBase64ToDownloads({ base64, name, mimeType: blob.type });
  return uri;
}

export async function saveModelToDownloads(fileId: string, name: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Saving to Downloads works in the installed Android app.');
  }
  const sourcePath = await modelFileUri(fileId);
  if (!sourcePath) throw new Error('The model file is no longer on this device');
  const { uri } = await Native.saveToDownloads({ sourcePath, name });
  return uri;
}
