import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6 } from './video_scenes';

const SCENE_DURATIONS = {
  opening: 4200,
  investigation: 3600,
  helpers: 4200,
  rooms: 3800,
  rematch: 3900,
  finale: 4200,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  const scenes = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6];
  const Scene = scenes[currentScene] ?? Scene1;

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      className="overflow-hidden bg-[#0b0909] text-[#f7e5c7]"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-[-10%]"
          animate={{
            background: [
              'radial-gradient(circle at 82% 25%, #d7493218, transparent 35%), radial-gradient(circle at 15% 80%, #b9855512, transparent 30%), #0b0909',
              'radial-gradient(circle at 64% 45%, #d749321b, transparent 38%), radial-gradient(circle at 28% 65%, #b9855517, transparent 34%), #0b0909',
            ],
          }}
          transition={{ duration: 7, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
        <div className="noise absolute inset-0" />
        <motion.div
          className="absolute left-[-8vw] top-[28vh] h-[.18vh] w-[116vw] origin-center bg-[#d74932]/25"
          animate={{ rotate: currentScene % 2 ? -4 : 4, y: currentScene * 2 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="absolute right-[6vw] top-[14vh] h-[42vh] w-[.15vw] bg-[#e7b866]/20"
          animate={{ y: currentScene % 2 ? 12 : -8, opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="pointer-events-none absolute bottom-[3vh] left-[6vw] right-[6vw] z-20 flex items-center justify-between text-[.8vw] tracking-[.16em] text-[#806d61]">
        <span>عصابة الملاعب / ٢٠٢٤</span>
        <span>{String(currentScene + 1).padStart(2, '0')} — 06</span>
      </div>
      <AnimatePresence mode="sync">
        <motion.div
          key={currentScene}
          className="absolute inset-0"
          initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
          animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
          exit={{ clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
          transition={{ duration: .8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Scene />
        </motion.div>
      </AnimatePresence>
    </VideoCanvas>
  );
}
