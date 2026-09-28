import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/company-dna")({
  head: () => ({
    meta: [
      { title: "Company DNA — CampaignForge" },
      {
        name: "description",
        content: "Your brand voice and rules, applied to every plan and post.",
      },
    ],
  }),
  component: CompanyDnaPage,
});

type Dna = {
  brand_name: string;
  voice: string;
  phrases_use: string;
  words_avoid: string;
  facts: string;
  persona: string;
  example_post: string;
  disclaimer: string;
  languages: string;
};

const EMPTY: Dna = {
  brand_name: "",
  voice: "",
  phrases_use: "",
  words_avoid: "",
  facts: "",
  persona: "",
  example_post: "",
  disclaimer: "",
  languages: "English",
};

const FIELDS: Array<{ key: keyof Dna; label: string; hint: string; rows?: number }> = [
  { key: "brand_name", label: "Brand name", hint: "Your brand or company name" },
  {
    key: "voice",
    label: "Brand voice",
    hint: "How you sound, e.g. warm, expert, never pushy",
    rows: 2,
  },
  {
    key: "phrases_use",
    label: "Signature phrases",
    hint: "Words and phrases that fit your brand",
    rows: 2,
  },
  {
    key: "words_avoid",
    label: "Banned words",
    hint: "Words and claims the AI must never use",
    rows: 2,
  },
  {
    key: "facts",
    label: "Approved facts",
    hint: "Prices, offers and product facts. The AI will not invent others.",
    rows: 3,
  },
  {
    key: "persona",
    label: "Who we speak to",
    hint: "Your audience, in a sentence or two",
    rows: 2,
  },
  { key: "example_post", label: "Voice sample", hint: "A post that shows your tone", rows: 3 },
  {
    key: "disclaimer",
    label: "Mandatory disclaimer",
    hint: "Added to any post that mentions an offer",
  },
  { key: "languages", label: "Content languages", hint: "e.g. English, Hindi" },
];

function CompanyDnaPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Dna>(EMPTY);

  const dna = useQuery({
    queryKey: ["brand_dna"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_dna").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (dna.data) {
      const { user_id: _u, updated_at: _t, ...rest } = dna.data;
      setForm({ ...EMPTY, ...rest });
    }
  }, [dna.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("brand_dna")
        .upsert({ ...form, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand_dna"] });
      toast.success("Company DNA saved. Every new plan and post will follow it.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow">Applied to every AI output</p>
      <h1 className="mt-2 text-3xl font-semibold">Company DNA</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Save your brand voice and rules once. Plans, channel posts, ad copy, blogs, emails and
        voiceover scripts all follow them.
      </p>

      <form
        className="panel mt-8 space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={`dna-${f.key}`}>{f.label}</Label>
            {f.rows ? (
              <Textarea
                id={`dna-${f.key}`}
                rows={f.rows}
                placeholder={f.hint}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                id={`dna-${f.key}`}
                placeholder={f.hint}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
        <Button type="submit" disabled={save.isPending || dna.isLoading}>
          {save.isPending ? "Saving…" : "Save Company DNA"}
        </Button>
      </form>
    </main>
  );
}
