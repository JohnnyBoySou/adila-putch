import folderbg1 from "@/assets/folder-bg-1.png";
import folderbg2 from "@/assets/folder-bg-2.png";
import folderbg3 from "@/assets/folder-bg-3.png";
import folderbg4 from "@/assets/folder-bg-4.png";
import folderbg5 from "@/assets/folder-bg-5.png";
import folderbg6 from "@/assets/folder-bg-6.png";
import folderDark from "@/assets/folder-dark.svg?url";
import folderLight from "@/assets/folder-light.svg?url";
import { useTheme } from "@/contexts/theme.context";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

const options = [
  {
    bg: folderbg1,
  },
  {
    bg: folderbg2,
  },
  {
    bg: folderbg3,
  },
  {
    bg: folderbg4,
  },
  {
    bg: folderbg5,
  },
  {
    bg: folderbg6,
  },
];

export default function Folder({ className, option = 0 }: { className?: string; option?: number }) {
  const { theme } = useTheme();
  const src = theme === "ultra-dark" ? folderDark : folderLight;
  const { bg } = options[((option % options.length) + options.length) % options.length];

  return (
    <div className={cn("relative h-44 w-44", className)}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="absolute top-8 right-0 left-4 w-12 h-24 bg-foreground/50 z-10 rotate-[-10deg] backdrop-blur-sm"
      />
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="absolute top-8 right-0 left-28 w-12 h-24 bg-foreground/50 z-10 rotate-10 backdrop-blur-sm"
      />
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="absolute top-4 right-0 left-16 w-12 h-24 bg-foreground/50 z-10  backdrop-blur-sm"
      />
      <img
        src={bg}
        alt="Background"
        className="pointer-events-none  h-32 w-44 absolute top-0 right-0 left-0 z-0"
      />
      <img
        src={src}
        alt="Folder"
        className="pointer-events-none absolute bottom-0 z-10 h-44 w-44"
      />
    </div>
  );
}
