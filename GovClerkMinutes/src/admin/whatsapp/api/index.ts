import { sendMessage } from "./messages";
import { getTemplates, sendTemplateMessage } from "./templates";
import { uploadMedia, getMediaUrl, deleteMedia, downloadMedia } from "./media";
import { preAcceptCall, acceptCall, rejectCall, terminateCall } from "./calls";
import {
  requestVerificationCode,
  verifyCode,
  getPhoneNumbers,
  registerPhoneNumber,
} from "./phoneNumbers";

const whatsapp = {
  sendMessage,
  getTemplates,
  sendTemplateMessage,
  uploadMedia,
  getMediaUrl,
  deleteMedia,
  downloadMedia,
  preAcceptCall,
  acceptCall,
  rejectCall,
  terminateCall,
  requestVerificationCode,
  verifyCode,
  getPhoneNumbers,
  registerPhoneNumber,
};

export default whatsapp;
