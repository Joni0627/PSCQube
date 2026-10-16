import React, { useState, useEffect } from 'react';
import { GlassCard, GlassButton, GlassInput, GlassSelect } from '../../ui/GlassUI';
import { FileText, Image as ImageIcon, File, Plus, Edit2, Trash2, Save, X, UploadCloud, Loader2, Check } from 'lucide-react';
import { getSupabase } from '../../../lib/supabaseClient';
import { AppUser } from '../../../types';
import { cn } from '../../../lib/utils';

interface Notification {
  id: string;
  type: 'TEXT' | 'PDF' | 'IMAGE';
  title: string | null;
  content: string | null;
  file_url: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string | null;
}

const formatForInput = (dateString: string | undefined | null) => {
  if (!dateString) return '';
  // If user typed string (length 16 without Z), return it directly to preserve their input perfectly
  if (dateString.length === 16 && !dateString.endsWith('Z')) return dateString;
  
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

export default function NotificacionesView({ currentUser }: { currentUser: AppUser }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentNotif, setCurrentNotif] = useState<Partial<Notification> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'TEXT' | 'PDF' | 'IMAGE'>('TEXT');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const supabaseClient = getSupabase();
    if (!supabaseClient) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from('notificaciones_v2')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentNotif) return;
    const supabaseClient = getSupabase();
    if (!supabaseClient) return;

    try {
      let finalFileUrl = currentNotif.file_url;
      if (selectedFile) {
        setIsUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabaseClient.storage
          .from('notificaciones_files')
          .upload(filePath, selectedFile);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabaseClient.storage
          .from('notificaciones_files')
          .getPublicUrl(filePath);
          
        finalFileUrl = data.publicUrl;
      }

      const payload = {
        ...currentNotif,
        file_url: finalFileUrl,
        start_date: currentNotif.start_date ? new Date(currentNotif.start_date).toISOString() : new Date().toISOString(),
        end_date: currentNotif.end_date ? new Date(currentNotif.end_date).toISOString() : new Date().toISOString(),
        created_by: currentNotif.created_by || currentUser?.email || currentUser?.id,
      };

      if (currentNotif.id) {
        await supabaseClient.from('notificaciones_v2').update(payload).eq('id', currentNotif.id);
      } else {
        await supabaseClient.from('notificaciones_v2').insert([payload]);
      }
      setIsEditing(false);
      setCurrentNotif(null);
      setSelectedFile(null);
      setIsUploading(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error saving notification:', error);
      alert('Error al guardar la notificación');
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar notificación?')) return;
    const supabaseClient = getSupabase();
    if (!supabaseClient) return;

    try {
      await supabaseClient.from('notificaciones_v2').delete().eq('id', id);
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type: string) => {
    if (type === 'TEXT') return <FileText size={18} className="text-blue-500" />;
    if (type === 'IMAGE') return <ImageIcon size={18} className="text-orange-500" />;
    return <File size={18} className="text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wider text-text-main">
            Notificaciones
          </h2>
          <p className="text-xs text-text-muted">Gestiona el contenido de las pantallas</p>
        </div>
        {!isEditing && (
          <GlassButton onClick={() => {
            setCurrentNotif({ type: activeTab, title: '', start_date: '', end_date: '', content: '' });
            setSelectedFile(null);
            setIsEditing(true);
          }} className="flex items-center gap-2">
            <Plus size={16} /> NUEVA NOTIFICACIÓN
          </GlassButton>
        )}
      </div>

      {isEditing && currentNotif ? (
        <GlassCard className="p-6 border border-primary/20 bg-primary/5">
          <h3 className="text-sm font-bold uppercase mb-4">{currentNotif.id ? 'Editar' : 'Nueva'} Notificación</h3>
          <div className="flex flex-col gap-4">
            <GlassSelect
              label="Tipo de Información"
              value={currentNotif.type || 'TEXT'}
              onChange={(e: any) => setCurrentNotif({ ...currentNotif, type: e.target.value as any })}
              options={[
                { value: 'TEXT', label: 'Texto Plano' },
                { value: 'PDF', label: 'Documento PDF' },
                { value: 'IMAGE', label: 'Imagen' },
              ]}
            />
            <GlassInput
              label="Título"
              value={currentNotif.title || ''}
              onChange={(e: any) => setCurrentNotif({ ...currentNotif, title: e.target.value })}
              placeholder="Ej. Novedad del Turno"
            />
            {currentNotif.type === 'TEXT' ? (
              <GlassInput
                label="Contenido"
                value={currentNotif.content || ''}
                onChange={(e: any) => setCurrentNotif({ ...currentNotif, content: e.target.value })}
                placeholder="Mensaje a mostrar..."
              />
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-semibold text-text-muted ml-0.5">Archivo (PDF o Imagen)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center justify-center gap-2 px-4 h-11 bg-bg-input border border-border rounded-lg cursor-pointer hover:border-primary transition-all flex-1 text-sm text-text-main relative overflow-hidden group">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept={currentNotif.type === 'PDF' ? 'application/pdf' : 'image/*'}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                    />
                    <UploadCloud size={16} className="text-primary group-hover:scale-110 transition-transform" />
                    <span className="truncate">{selectedFile ? selectedFile.name : currentNotif.file_url ? 'Cambiar Archivo Actual' : 'Seleccionar Archivo...'}</span>
                  </label>
                  {(selectedFile || currentNotif.file_url) && (
                    <div className="w-11 h-11 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center text-primary" title="Archivo seleccionado">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <GlassInput
              label="Inicio de Presentación"
              type="datetime-local"
              value={formatForInput(currentNotif.start_date)}
              onChange={(e: any) => setCurrentNotif({ ...currentNotif, start_date: e.target.value })}
            />
            <GlassInput
              label="Fin de Presentación"
              type="datetime-local"
              value={formatForInput(currentNotif.end_date)}
              onChange={(e: any) => setCurrentNotif({ ...currentNotif, end_date: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <GlassButton variant="secondary" onClick={() => setIsEditing(false)} disabled={isUploading}>Cancelar</GlassButton>
            <GlassButton onClick={handleSave} disabled={isUploading} className="flex items-center gap-2">
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
              {isUploading ? 'Guardando...' : 'Guardar'}
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="flex bg-bg-input rounded-xl p-1 mb-6 max-w-fit">
            {[
              { id: 'TEXT', label: 'Texto', icon: <FileText size={16} /> },
              { id: 'PDF', label: 'PDF', icon: <File size={16} /> },
              { id: 'IMAGE', label: 'Imagen', icon: <ImageIcon size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text-main hover:bg-bg"
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="py-8 text-center text-text-muted text-sm">Cargando...</div>
            ) : notifications.filter(n => n.type === activeTab).length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm border border-dashed border-border rounded-xl">
                No hay notificaciones de tipo {activeTab} registradas.
              </div>
            ) : (
              notifications.filter(n => n.type === activeTab).map(n => {
                const isVigente = new Date(n.end_date) > new Date();
                return (
                <GlassCard key={n.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-text-main truncate mb-1 flex items-center gap-2">
                        {n.title || 'Sin Título'}
                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", isVigente ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                          {isVigente ? 'Vigente' : 'Concluida'}
                        </span>
                      </h4>
                      {n.type === 'TEXT' ? (
                        <p className="text-sm text-text-muted line-clamp-2">{n.content}</p>
                      ) : (
                        <a href={n.file_url || '#'} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline truncate block">
                          {n.file_url ? 'Ver Archivo Adjunto' : 'Sin Archivo'}
                        </a>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-text-muted uppercase tracking-wider font-semibold">
                        <span>Inicio: <span className="text-text-main">{n.start_date ? new Date(n.start_date).toLocaleString() : ''}</span></span>
                        <span>•</span>
                        <span>Fin: <span className="text-text-main">{n.end_date ? new Date(n.end_date).toLocaleString() : ''}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 border-l border-border pl-4">
                    <button onClick={() => { setCurrentNotif(n); setIsEditing(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </GlassCard>
              )})
            )}
          </div>
        </div>
      )}
    </div>
  );
}
