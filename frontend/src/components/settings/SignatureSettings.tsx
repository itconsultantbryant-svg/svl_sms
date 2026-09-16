import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const ROLES = [
  { key: 'registrar', title: 'Registrar', order: 1 },
  { key: 'principal', title: 'Principal', order: 2 },
  { key: 'board_chair', title: 'Board Chair', order: 3 },
] as const;

/** Remove near-white / light backgrounds so signatures sit cleanly on gradesheets. */
export async function extractSignatureBackground(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read signature file'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 220) {
          data[i + 3] = 0;
        } else if (brightness > 180) {
          data[i + 3] = Math.round(data[i + 3] * 0.35);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Could not process signature image'));
    image.src = dataUrl;
  });
}

export default function SignatureSettings() {
  const queryClient = useQueryClient();
  const { data: signatures } = useQuery<any[]>({
    queryKey: ['institution-signatures'],
    queryFn: () => api.get('/settings/signatures').then((r) => r.data),
  });
  const byRole = useMemo(() => {
    const map = new Map<string, any>();
    (signatures || []).forEach((row) => map.set(row.role_key, row));
    return map;
  }, [signatures]);

  const [forms, setForms] = useState<Record<string, { signer_name: string; signer_title: string; signature_image: string }>>({});

  const saveMutation = useMutation({
    mutationFn: ({ role, payload }: { role: string; payload: any }) => api.put(`/settings/signatures/${role}`, payload),
    onSuccess: () => {
      toast.success('Signature saved');
      queryClient.invalidateQueries({ queryKey: ['institution-signatures'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Could not save signature'),
  });

  const removeMutation = useMutation({
    mutationFn: (role: string) => api.delete(`/settings/signatures/${role}`),
    onSuccess: () => {
      toast.success('Signature removed');
      queryClient.invalidateQueries({ queryKey: ['institution-signatures'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Could not remove signature'),
  });

  const formFor = (role: typeof ROLES[number]) => {
    const existing = byRole.get(role.key);
    return forms[role.key] || {
      signer_name: existing?.signer_name || '',
      signer_title: existing?.signer_title || role.title,
      signature_image: existing?.signature_image || '',
    };
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Official signatures</h2>
        <p className="text-sm text-gray-500 mt-1">Upload up to three signatures for gradesheets and transcripts. Light backgrounds are removed automatically.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ROLES.map((role) => {
          const form = formFor(role);
          return (
            <div key={role.key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">{role.title}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signer name *</label>
                <input
                  className="input-field"
                  value={form.signer_name}
                  onChange={(e) => setForms((current) => ({ ...current, [role.key]: { ...form, signer_name: e.target.value } }))}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position / title *</label>
                <input
                  className="input-field"
                  value={form.signer_title}
                  onChange={(e) => setForms((current) => ({ ...current, [role.key]: { ...form, signer_title: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signature image</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input-field"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const cleaned = await extractSignatureBackground(file);
                      setForms((current) => ({ ...current, [role.key]: { ...form, signature_image: cleaned } }));
                      toast.success('Background cleaned');
                    } catch (err: any) {
                      toast.error(err.message || 'Could not process image');
                    }
                  }}
                />
              </div>
              {form.signature_image ? (
                <div className="bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_8px,#eef2ff_8px,#eef2ff_16px)] rounded p-3">
                  <img src={form.signature_image} alt="" className="h-16 mx-auto object-contain" />
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={!form.signer_name || !form.signature_image || saveMutation.isPending}
                  onClick={() => saveMutation.mutate({
                    role: role.key,
                    payload: { ...form, sort_order: role.order },
                  })}
                >
                  Save
                </button>
                {byRole.get(role.key) ? (
                  <button type="button" className="btn-secondary" onClick={() => removeMutation.mutate(role.key)}>Remove</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
