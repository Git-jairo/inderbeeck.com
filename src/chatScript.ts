// The opening conversation. One entry per chat message ("page"). `visuals` are the
// dot-grid scenes shown while that message is on screen; with more than one they
// take turns. null = the idle wave.
export type Page = {
  text: string
  visuals: (string | null)[]
}

// A small personal touch: greet the visitor according to their local time of day.
export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Hello, night owl'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function buildScript(hello: string): Page[] {
  return [
    {
      text: `${hello}. I'm Jairo. Glad you're here. Let me give you a little glimpse into what I do, what I'm curious about, and what keeps me going.`,
      visuals: ['chat'],
    },
    {
      text: "I'm a UX and digital product designer, interested in the bigger picture just as much as the details. I enjoy making sense of complex things, connecting dots, and turning ideas into experiences that feel intuitive, useful, and human.",
      visuals: ['product-design', 'system-design'],
    },
    {
      text: "More recently, I've been exploring the intersection of design, systems, and AI. Not just what technology can do, but how we make it meaningful, accessible, and genuinely helpful to people.",
      visuals: ['ai-enablement', 'system-design'],
    },
    {
      text: "Outside of design, you'll often find me in a sports studio in Amsterdam, working as a trainer. It's a different kind of work, but the mindset feels familiar: understand people, meet them where they are, and help them move forward.",
      visuals: ['sports'],
    },
    {
      text: 'Movement is a big part of my own life, too. I run marathons and ultras, partly for the challenge, but mostly for everything that comes with it. The long miles have a way of teaching you patience, perspective, and how to keep going when things get uncomfortable.',
      visuals: ['track'],
    },
    {
      text: "I guess both sides of my life have something in common. I'm drawn to figuring things out, pushing boundaries, staying curious, and finding ways to make progress, whether that's through design, technology, or a few more miles on the road.",
      visuals: ['product-design', 'track'],
    },
    {
      text: "Anyway, that's a little about me. There's more to explore, more things I'm working on, and probably a few rabbit holes worth going down. Take a look around. I'd love for you to find something that sparks your curiosity, too.",
      visuals: [null],
    },
  ]
}
