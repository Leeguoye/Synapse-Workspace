import { ipcMain } from 'electron';
import {
  saveCredential,
  listCredentials,
  getCredential,
  deleteCredential,
  CredentialInput
} from '../services/CredentialService';

export function registerCredentialIpc() {
  ipcMain.handle('credential:list', async () => {
    return await listCredentials();
  });

  ipcMain.handle('credential:save', async (_, input: CredentialInput) => {
    return await saveCredential(input);
  });

  ipcMain.handle('credential:delete', async (_, key: string) => {
    return await deleteCredential(key);
  });
}
