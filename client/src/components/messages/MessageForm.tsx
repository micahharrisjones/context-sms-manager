import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendTestMessage } from "@/lib/clicksend";
import { useToast } from "@/hooks/use-toast";

export function MessageForm() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const result = await sendTestMessage(message);
      toast({
        description: result.success ? "Message sent successfully" : result.message,
        variant: result.success ? "default" : "destructive",
      });
      if (result.success) {
        setMessage("");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a test message..."
        disabled={sending}
      />
      <Button type="submit" disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}