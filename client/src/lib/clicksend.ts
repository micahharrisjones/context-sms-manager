import { apiRequest } from "./queryClient";

interface SendSMSResponse {
  success: boolean;
  message: string;
  details?: string;
}

export async function sendTestMessage(content: string): Promise<SendSMSResponse> {
  try {
    console.log("Sending test message:", content);
    const response = await apiRequest("POST", "/api/messages", {
      content,
      senderId: "test-user",
      tags: content.match(/#\w+/g)?.map(tag => tag.slice(1)) || ["test"],
    });

    const data = await response.json();
    console.log("Test message response:", data);

    return { 
      success: true, 
      message: "Message sent successfully",
      details: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Error sending test message:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to send message",
      details: error instanceof Error ? error.stack : undefined
    };
  }
}