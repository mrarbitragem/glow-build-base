import { useEffect, useMemo, useState } from 'react';
import { initials } from '@/utils/helpers';
import { extractGoogleDriveFileId, normalizeClubFlagSrc } from '@/utils/clubFlag';

type Props = {
  flag?: string;
  name: string;
  /** Classes do contêiner (ex.: `flag`, `flag large`) */
  boxClassName?: string;
};

export function ClubFlagMedia({ flag, name, boxClassName = 'flag' }: Props) {
  const raw = (flag || '').trim();
  const primary = useMemo(() => normalizeClubFlagSrc(raw), [raw]);
  const driveId = useMemo(() => extractGoogleDriveFileId(raw), [raw]);
  const driveUc = driveId
    ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`
    : '';
  const [useDriveUc, setUseDriveUc] = useState(false);
  const [broken, setBroken] = useState(false);

  const src = useDriveUc && driveUc ? driveUc : primary;

  useEffect(() => {
    setBroken(false);
    setUseDriveUc(false);
  }, [raw]);

  if (!src || broken) {
    return <div className={`${boxClassName} placeholder`}>{initials(name)}</div>;
  }

  return (
    <div className={boxClassName}>
      <img
        src={src}
        alt={`Bandeira ${name}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (driveUc && !useDriveUc && src !== driveUc) setUseDriveUc(true);
          else setBroken(true);
        }}
      />
    </div>
  );
}
