'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { FieldShell, TextInput, TextArea } from '@/components/ui/form-field';

const schema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().min(20).max(500),
  location: z.string().trim().min(2).max(100), category: z.string().trim().min(2).max(80) });
export function ProfileEditor({ initial }: { initial: z.infer<typeof schema> }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) { setMessage('Use a name and location of at least 2 characters, and a description of 20–500 characters.'); return; }
    setBusy(true);
    try {
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error('Unavailable');
      const { error } = await client.rpc('update_profile_details', { profile_data: parsed.data });
      if (error) throw new Error('Save failed');
      setMessage('Profile updated.'); router.refresh();
    } catch { setMessage('Your profile could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6" onSubmit={save}>
    <h2 className="text-lg font-bold text-slate-950">Profile details</h2>
    <FieldShell label="Display name" name="profile-name"><TextInput id="profile-name" value={values.name} maxLength={80} onChange={(event) => setValues({ ...values, name: event.target.value })} required /></FieldShell>
    <div className="grid gap-4 sm:grid-cols-2"><FieldShell label="Niche or industry" name="profile-category"><TextInput id="profile-category" value={values.category} maxLength={80} onChange={(event) => setValues({ ...values, category: event.target.value })} required /></FieldShell><FieldShell label="Location" name="profile-location"><TextInput id="profile-location" value={values.location} maxLength={100} onChange={(event) => setValues({ ...values, location: event.target.value })} required /></FieldShell></div>
    <FieldShell label="About you" name="profile-description"><TextArea id="profile-description" value={values.description} minLength={20} maxLength={500} rows={5} onChange={(event) => setValues({ ...values, description: event.target.value })} required /></FieldShell>
    <Button className="sm:w-fit" loading={busy} type="submit">Save profile</Button>{message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
  </form>;
}
