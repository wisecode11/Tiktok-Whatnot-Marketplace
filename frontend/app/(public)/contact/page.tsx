import { Button } from "@/components/ui/button"
import { SUPPORT_EMAIL } from "@/lib/brand"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Mail, MessageSquare, Phone, MapPin } from "lucide-react"

const contactMethods = [
  {
    icon: Mail,
    title: "Email",
    description: "Send us an email anytime",
    value: SUPPORT_EMAIL,
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    description: "Chat with our support team",
    value: "Available 24/7",
  },
  {
    icon: Phone,
    title: "Phone",
    description: "Call us during business hours",
    value: "+1 (555) 123-4567",
  },
  {
    icon: MapPin,
    title: "Office",
    description: "Visit our headquarters",
    value: "San Francisco, CA",
  },
]

export default function ContactPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Contact Us
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Have questions? We are here to help. Reach out to our team anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {contactMethods.map((method) => (
              <Card key={method.title} className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2">
                    <method.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{method.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {method.description}
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {method.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Form */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup>
                      <Field>
                        <FieldLabel>First Name</FieldLabel>
                        <Input placeholder="John" className="bg-muted/50" />
                      </Field>
                    </FieldGroup>
                    <FieldGroup>
                      <Field>
                        <FieldLabel>Last Name</FieldLabel>
                        <Input placeholder="Doe" className="bg-muted/50" />
                      </Field>
                    </FieldGroup>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        className="bg-muted/50"
                      />
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Subject</FieldLabel>
                      <Select>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select a topic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Inquiry</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="support">
                            Technical Support
                          </SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Message</FieldLabel>
                      <Textarea
                        placeholder="Tell us how we can help..."
                        rows={5}
                        className="bg-muted/50"
                      />
                    </Field>
                  </FieldGroup>

                  <Button type="submit" className="w-full">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* FAQ Preview */}
            <div>
              <h3 className="mb-6 text-xl font-semibold">Common Questions</h3>
              <div className="space-y-4">
                {[
                  {
                    q: "How do I get started?",
                    a: "Sign up for a free account and follow our onboarding guide. You can start streaming within minutes.",
                  },
                  {
                    q: "What platforms do you support?",
                    a: "We currently support TikTok Shop and Whatnot, with more platforms coming soon.",
                  },
                  {
                    q: "How does billing work?",
                    a: "We offer monthly and annual plans. You can start with a free trial and upgrade anytime.",
                  },
                  {
                    q: "Can I cancel anytime?",
                    a: "Yes, you can cancel your subscription at any time. No long-term commitments required.",
                  },
                ].map((item) => (
                  <Card key={item.q} className="border-border/50 bg-card/50">
                    <CardContent className="p-4">
                      <h4 className="font-medium">{item.q}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.a}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
