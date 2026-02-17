import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const feedbackSchema = z.object({
  feedbackType: z.enum(["bug", "suggestion", "general"], {
    required_error: "Please select a feedback type",
  }),
  name: z.string().max(100).optional(),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Subject is required").max(100, "Subject must be 100 characters or less"),
  message: z.string().min(1, "Message is required").max(2000, "Message must be 2000 characters or less"),
  consent: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms to submit feedback",
  }),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

export default function FeedbackPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedbackType: undefined,
      name: "",
      email: "",
      subject: "",
      message: "",
      consent: false,
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, GIF, or WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5 MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: "Image must be under 5 MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);

    try {
      let imageData = null;

      // Convert image to base64 if present
      if (selectedImage) {
        const reader = new FileReader();
        imageData = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedImage);
        });
      }

      const response = await apiRequest("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedbackType: data.feedbackType,
          name: data.name || null,
          email: data.email,
          subject: data.subject,
          message: data.message,
          imageData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsSuccess(true);
        toast({
          title: "Feedback submitted!",
          description: result.message || "Thank you for your feedback. We've received your submission.",
        });
      } else {
        throw new Error(result.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#faf6f3] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#263d57] mb-2">Thank you for your feedback!</h2>
            <p className="text-gray-600 mb-6">
              We've received your submission. Submissions are typically reviewed within 2 business days.
            </p>
            <Button
              data-testid="button-submit-another"
              onClick={() => {
                setIsSuccess(false);
                form.reset();
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="bg-[#b95827] hover:bg-[#a04a1f] text-white"
            >
              Submit Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf6f3] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
          <div className="flex justify-center mb-6">
            <Logo className="w-auto h-12" />
          </div>
          <h1 className="text-3xl font-bold text-[#263d57] mb-2">Submit Feedback for Aside</h1>
          <p className="text-gray-600 mb-6">
            We value your input to enhance Aside. Use this form to report bugs, share suggestions, or provide general feedback.
            Your contributions help us deliver a better experience. All submissions are reviewed by our team, and we may follow up
            via email if additional details are needed.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Feedback Type */}
              <FormField
                control={form.control}
                name="feedbackType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-feedback-type">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="suggestion">Feature Suggestion</SelectItem>
                        <SelectItem value="general">General Feedback</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the category that best describes your feedback
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name (Optional) */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-name"
                        placeholder="Your name"
                        maxLength={100}
                      />
                    </FormControl>
                    <FormDescription>
                      Helps us personalize our response
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-email"
                        type="email"
                        placeholder="your@email.com"
                      />
                    </FormControl>
                    <FormDescription>
                      We use this only for clarification on your feedback
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-subject"
                        placeholder="Brief title for your feedback"
                        maxLength={100}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/100 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Message */}
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message/Details *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="textarea-message"
                        placeholder="Describe the bug or suggestion, including steps to reproduce if applicable"
                        rows={6}
                        maxLength={2000}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/2000 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image Attachment */}
              <div className="space-y-2">
                <FormLabel>Attachment (Optional)</FormLabel>
                <div className="space-y-3">
                  {!imagePreview ? (
                    <div>
                      <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        data-testid="input-file"
                      />
                      <label htmlFor="image-upload">
                        <Button
                          type="button"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => document.getElementById("image-upload")?.click()}
                          data-testid="button-upload"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </Button>
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        Upload screenshots or relevant images (max 5 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-xs max-h-48 rounded-lg border border-gray-200"
                        data-testid="img-preview"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                        data-testid="button-remove-image"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Consent Checkbox */}
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I agree to the Terms of Use and understand my feedback may be used to improve Aside *
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#b95827] hover:bg-[#a04a1f] text-white"
                data-testid="button-submit"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </Form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Thank you for helping us improve Aside. Submissions are typically reviewed within 2 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
