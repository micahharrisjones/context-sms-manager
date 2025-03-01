import { apiRequest } from "./queryClient";

interface SendSMSResponse {
  success: boolean;
  message: string;
}

export async function sendTestMessage(content: string): Promise<SendSMSResponse> {
  try {
    const response = await apiRequest("POST", "/api/messages", {
      content,
      senderId: "test-user",
      tags: content.match(/#\w+/g) || [],
    });
    const data = await response.json();
    return { success: true, message: "Message sent successfully" };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to send message" 
    };
  }
}
