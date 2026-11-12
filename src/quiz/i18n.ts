import type { Lang } from "./questions";

export type Texts = {
  title: string;
  subtitle: string;
  comment: string;
  outro: string;
  outroSub: string;
};

export const TEXTS: Record<Lang, Texts> = {
  en: {
    title: "Quiz Time!",
    subtitle: "How many can you get right?",
    comment: "Write your answer in the comments!",
    outro: "Thanks for watching!",
    outroSub: "Subscribe for more quizzes",
  },
  ar: {
    title: "حان وقت الاختبار!",
    subtitle: "كم إجابة صحيحة ستحصل عليها؟",
    comment: "اكتب إجابتك في التعليقات!",
    outro: "شكراً للمشاهدة!",
    outroSub: "اشترك لمزيد من الأسئلة",
  },
};
