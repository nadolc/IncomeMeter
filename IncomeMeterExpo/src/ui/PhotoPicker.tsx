import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, Text, View } from 'react-native';
import { getById, remove } from '../db/repo';
import { addAttachment } from '../services/data';
import { Button, colors, Row, styles } from './components';
import { useLive } from './hooks';
import { useT } from './i18n';

/** EXIF "2024:05:17 14:03:22" (no zone – wall clock) → ISO. */
function exifDate(exif: Record<string, unknown> | null | undefined): string | null {
  const raw = (exif?.DateTimeOriginal ?? exif?.DateTime) as string | undefined;
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
}

export interface PickedPhoto { id: string; takenAt: string | null }

export function PhotoPicker({ ids, onChange, max = 5, onAdded }: {
  ids: string[]; onChange: (ids: string[]) => void; max?: number; onAdded?: (photo: PickedPhoto) => void;
}) {
  const t = useT();
  const attachments = useLive(() => ids.map((id) => getById('attachments', id)).filter(Boolean), ['attachments'], [ids.join(',')]);

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: true, quality: 0.8 };
    const res = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const takenAt = exifDate(asset.exif) ?? (camera ? new Date().toISOString() : null);
    const a = await addAttachment(asset.uri, asset.fileName, asset.mimeType, takenAt);
    onChange([...ids, a.id]);
    onAdded?.({ id: a.id, takenAt });
  };

  const drop = (id: string) => {
    onChange(ids.filter((x) => x !== id));
    const a = getById('attachments', id);
    // Photos never uploaded are only on this phone – delete the record with the reference.
    if (a && !a.uploaded) remove('attachments', id);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{t('photo')}</Text>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {attachments.map((a) => (
          <Pressable key={a!.id} onLongPress={() => drop(a!.id)}>
            {a!.localUri
              ? <Image source={{ uri: a!.localUri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
              : <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}><Text>☁︎</Text></View>}
            <Text onPress={() => drop(a!.id)} style={{ position: 'absolute', top: 2, right: 6, color: '#fff', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 3 }}>✕</Text>
          </Pressable>
        ))}
      </Row>
      {ids.length < max ? (
        <Row style={{ gap: 8 }}>
          <Button small kind="secondary" title={t('takePhoto')} onPress={() => pick(true)} />
          <Button small kind="secondary" title={t('addPhoto')} onPress={() => pick(false)} />
        </Row>
      ) : null}
    </View>
  );
}
