import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MediaFrame, SafeFrame, SceneLayout, VideoText } from '@/lib/video';

const BASE = import.meta.env.BASE_URL;
const artwork = `${BASE}assets/game-artwork.jpg`;
const helperCards = `${BASE}assets/helper-cards-reference.jpg`;

const ease = [0.16, 1, 0.3, 1] as const;

function Stamp({ children }: { children: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: .7, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: -3 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: .55, ease }}
      className="absolute left-[6vw] top-[7vh] border border-[#d74932]/70 px-[1.2vw] py-[.55vw] text-[1.05vw] font-bold tracking-[.2em] text-[#d74932]"
    >
      ١٠ لاعبين · سر واحد
    </motion.div>
  );
}

function SceneFrame({ children, tone = '#d74932' }: { children: ReactNode; tone?: string }) {
  return (
    <SafeFrame>
      <div className="relative h-full w-full" dir="rtl" style={{ perspective: 1200 }}>
        <div className="absolute right-[-5vw] top-[-9vh] h-[45vh] w-[30vw] rounded-full blur-[7vw]" style={{ background: `radial-gradient(circle, ${tone}45, transparent 68%)` }} />
        <div className="absolute bottom-[-17vh] left-[12vw] h-[36vh] w-[36vw] rounded-full blur-[8vw]" style={{ background: `radial-gradient(circle, #e7b86622, transparent 68%)` }} />
        {children}
      </div>
    </SafeFrame>
  );
}

export function Scene1() {
  return (
    <SceneFrame>
      <Stamp>١٠ لاعبين · سر واحد</Stamp>
      <SceneLayout layout="split" className="!items-stretch !justify-between !gap-[5vw]">
        <div className="relative z-10 flex w-[47%] flex-col justify-center text-right">
          <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ scaleX: 0 }} transition={{ duration: .75, ease }} className="mb-[2vh] h-[.35vh] w-[10vw] origin-right bg-[#d74932]" />
          <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ delay: .18, duration: .55, ease }} className="label mb-[1.5vh] text-[1.2vw] text-[#e7b866]">لعبة الخداع والتحقيق</motion.p>
          <motion.h1 initial={{ opacity: 0, x: 60, rotateY: 16 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} exit={{ opacity: 0, scale: 1.12 }} transition={{ delay: .28, duration: .8, ease }} className="arabic-title text-[7.5vw] leading-[.95] text-[#f7e5c7]">
            عصابة<br /><span className="text-[#d74932]">الملاعب</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .9, duration: .5 }} className="mt-[2.2vh] max-w-[31vw] text-[1.55vw] leading-[1.7] text-[#bca995]">
            الجميع يملك دوراً.<br />لكن القائد المختبئ يملك المباراة.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: .72, rotate: 3, x: -80 }} animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }} exit={{ opacity: 0, scale: 1.45 }} transition={{ delay: .2, duration: 1.1, ease }} className="relative h-[74vh] w-[43%] overflow-hidden border border-[#b98555]/60 bg-[#0e0b0a] shadow-[0_1.5vw_4vw_#0008]">
          <MediaFrame fit="cover" position="top"><img src={artwork} alt="" /></MediaFrame>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0909] via-transparent to-[#0b090933]" />
          <div className="absolute bottom-[2.5vh] right-[1.7vw] border-r-2 border-[#d74932] pr-[1vw] text-[1.15vw] text-[#f7e5c7]">اكتشف هويته<br /><span className="text-[#bca995]">قبل أن يكتشفك</span></div>
        </motion.div>
      </SceneLayout>
    </SceneFrame>
  );
}

export function Scene2() {
  return (
    <SceneFrame tone="#b98555">
      <div className="absolute left-[4vw] top-[5vh] text-[5vw] font-black text-[#f7e5c7]/[.06]">?</div>
      <div className="absolute right-[4vw] bottom-[4vh] text-[11vw] font-black text-[#d74932]/[.05]">تحقيق</div>
      <div className="flex h-full flex-col justify-center">
        <motion.p initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: .55, ease }} className="label mb-[1vh] text-[1.2vw] text-[#e7b866]">المرحلة الأولى</motion.p>
        <motion.h2 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .9 }} transition={{ delay: .12, duration: .7, ease }} className="arabic-title max-w-[54vw] text-[5.3vw] leading-[1.12] text-[#f7e5c7]">اسأل.<br /><span className="text-[#d74932]">راقب.</span> اكشف.</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .7 }} className="mt-[2vh] max-w-[41vw] text-[1.6vw] leading-[1.7] text-[#bca995]">كل إجابة دليل. كل تردد يترك أثراً. لا أحد يعرف من يقود العصابة… إلا هو.</motion.p>
        <div className="mt-[5vh] flex items-center gap-[1.1vw]">
          {['سؤال', 'إجابة', 'اشتبه', 'صوّت'].map((item, i) => (
            <motion.div key={item} initial={{ opacity: 0, y: 25, rotate: i % 2 ? 3 : -3 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }} exit={{ opacity: 0, y: 20 }} transition={{ delay: .95 + i * .12, duration: .4, ease }} className={`border px-[1.35vw] py-[.9vw] text-[1.12vw] ${i === 2 ? 'border-[#d74932] bg-[#d74932]/15 text-[#d74932]' : 'border-[#b98555]/50 bg-[#211714]/80 text-[#f7e5c7]'}`}>
              {item}
            </motion.div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}

export function Scene3() {
  return (
    <SceneFrame tone="#d74932">
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-end justify-between">
          <div className="w-[36%]">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label mb-[1vh] text-[1.1vw] text-[#e7b866]">أوراق تغيّر الموازين</motion.p>
            <motion.h2 initial={{ opacity: 0, x: 45 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: .7, ease }} className="arabic-title text-[4.6vw] leading-[1.1] text-[#f7e5c7]">اطلب<br /><span className="text-[#d74932]">المساعدة.</span></motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .45 }} className="mt-[2vh] text-[1.4vw] leading-[1.7] text-[#bca995]">كاميرا مراقبة. تبديل. حصانة.<br />استخدمها في اللحظة الحاسمة.</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: .75, rotateY: 18 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ delay: .12, duration: .9, ease }} className="relative w-[56%] border border-[#b98555]/70 bg-[#100d0c] p-[.5vw] shadow-[1vw_1vw_0_#d7493222]">
            <MediaFrame fit="contain"><img src={helperCards} alt="" /></MediaFrame>
            <div className="absolute right-[1vw] top-[-1.7vh] bg-[#d74932] px-[1vw] py-[.5vh] text-[1vw] font-bold text-[#f7e5c7]">بطاقات المساعدة</div>
          </motion.div>
        </div>
      </div>
    </SceneFrame>
  );
}

export function Scene4() {
  return (
    <SceneFrame tone="#8cae77">
      <div className="absolute inset-[3vh_4vw] border border-[#b98555]/30" />
      <div className="flex h-full items-center gap-[7vw]">
        <motion.div initial={{ opacity: 0, rotateY: 22, x: -40 }} animate={{ opacity: 1, rotateY: 0, x: 0 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ duration: .8, ease }} className="relative w-[48%] overflow-hidden border border-[#b98555]/60 bg-[#100d0c] p-[1vw]">
          <div className="mb-[1.5vh] flex items-center justify-between border-b border-[#b98555]/30 pb-[1vh] text-[1vw] text-[#bca995]"><span>غرفة خاصة / 07</span><span className="text-[#8cae77]">● آمنة</span></div>
          <div className="grid grid-cols-5 gap-[.6vw]">
            {Array.from({ length: 10 }, (_, i) => <div key={i} className={`aspect-square border p-[.3vw] ${i === 6 ? 'border-[#d74932] bg-[#d7493226]' : 'border-[#b98555]/30 bg-[#211714]'}`}><div className="flex h-full items-center justify-center border border-[#f7e5c7]/10 text-[1.5vw] text-[#bca995]">{i + 1}</div></div>)}
          </div>
          <div className="mt-[1.6vh] flex items-center justify-between text-[.95vw] text-[#8cae77]"><span>تشفير طرفي</span><span>10 / 10 جاهزون</span></div>
        </motion.div>
        <div className="w-[38%] text-right">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label mb-[1vh] text-[1.1vw] text-[#8cae77]">العب من أي مكان</motion.p>
          <motion.h2 initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: .15, duration: .65, ease }} className="arabic-title text-[4.2vw] leading-[1.15] text-[#f7e5c7]">غرف<br /><span className="text-[#8cae77]">آمنة.</span> لعب حقيقي.</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .62 }} className="mt-[2vh] text-[1.45vw] leading-[1.7] text-[#bca995]">ادخل مع أصدقائك. صوّتوا بصدق.<br />والسر يبقى داخل الغرفة.</motion.p>
        </div>
      </div>
    </SceneFrame>
  );
}

export function Scene5() {
  return (
    <SceneFrame tone="#e7b866">
      <div className="flex h-full items-center justify-between gap-[4vw]">
        <div className="w-[40%]">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label mb-[1vh] text-[1.1vw] text-[#e7b866]">بعد صافرة النهاية</motion.p>
          <motion.h2 initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: .7, ease }} className="arabic-title text-[4.3vw] leading-[1.1] text-[#f7e5c7]">الجولة انتهت.<br /><span className="text-[#d74932]">لكن القصة؟</span></motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .5 }} className="mt-[2vh] text-[1.45vw] leading-[1.7] text-[#bca995]">شاهد إحصاءاتك، راجع قراراتك،<br />ثم اطلب rematch.</motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: .82, rotate: 4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ delay: .2, duration: .9, ease }} className="w-[51%] border border-[#b98555]/60 bg-[#120f0d] p-[1.7vw]">
          <div className="mb-[2vh] flex items-center justify-between border-b border-[#b98555]/40 pb-[1.2vh]"><span className="text-[1vw] text-[#bca995]">نتيجة المباراة</span><span className="text-[1vw] text-[#d74932]">جولة جديدة ↻</span></div>
          <div className="flex items-end gap-[1vw] border-b border-[#b98555]/25 pb-[2vh]">
            {[['التحقيق', '82%', 'd74932'], ['الإقناع', '68%', 'e7b866'], ['النجاة', '91%', '8cae77']].map(([label, value, color], i) => (
              <div key={label} className="flex-1"><div className="mb-[.8vh] text-[.9vw] text-[#bca995]">{label}</div><div className="h-[12vh] bg-[#261a16]"><motion.div initial={{ height: 0 }} animate={{ height: value }} exit={{ height: 0 }} transition={{ delay: .65 + i * .12, duration: .8, ease }} style={{ background: `#${color}` }} className="w-full self-end" /></div><div className="mt-[.8vh] text-[1.2vw] font-bold text-[#f7e5c7]">{value}</div></div>
            ))}
          </div>
          <div className="mt-[1.8vh] flex items-center justify-between text-[1vw]"><span className="text-[#bca995]">أفضل لاعب</span><span className="text-[#e7b866]">أنت تعرف من هو.</span></div>
        </motion.div>
      </div>
    </SceneFrame>
  );
}

export function Scene6() {
  return (
    <SceneFrame tone="#d74932">
      <div className="flex h-full flex-col items-center justify-center text-center">
        <motion.div initial={{ opacity: 0, scale: .4, rotate: -25 }} animate={{ opacity: 1, scale: 1, rotate: -3 }} exit={{ opacity: 0, scale: 1.5 }} transition={{ duration: .85, ease }} className="mb-[2.5vh] border border-[#d74932] px-[1.8vw] py-[.7vw] text-[1.1vw] font-bold tracking-[.16em] text-[#d74932]">لعبة واحدة · ألف احتمال</motion.div>
        <motion.h2 initial={{ opacity: 0, y: 35, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 1.12 }} transition={{ delay: .18, duration: 1, ease }} className="arabic-title text-[7vw] leading-[1.05] text-[#f7e5c7]">لا تثق بأحد.</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: .82, duration: .6 }} className="mt-[2.2vh] text-[2vw] text-[#e7b866]">الملعب لك. لكن العصابة بينكم.</motion.p>
        <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.18, duration: .7, ease }} className="mt-[5vh] h-[.3vh] w-[18vw] bg-[#d74932]" />
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 1.5 }} className="mt-[2.2vh] text-[1.2vw] tracking-[.18em] text-[#bca995]">عصابة الملاعب</motion.p>
      </div>
    </SceneFrame>
  );
}