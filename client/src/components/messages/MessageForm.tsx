import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendTestMessage } from "@/lib/clicksend";
import { useQueryClient } from "@tanstack/react-query";

interface MessageFormData {
  content: string;
}

export function MessageForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<MessageFormData>();

  const onSubmit = async (data: MessageFormData) => {
    setIsSubmitting(true);
    try {
      const result = await sendTestMessage(data.content);
      if (result.success) {
        toast({
          title: "Success",
          description: "Message sent successfully",
        });
        reset();
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-8">
      <Textarea
        {...register("content")}
        placeholder="Type your message here... Use #tags for categorization"
        className="min-h-[100px]"
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
