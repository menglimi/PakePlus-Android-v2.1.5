
export interface Shot {
  id: string;
  name: string; 
  description: string; 
  type: 'static' | 'pan' | 'dolly' | 'pov';
  vibe: 'descriptive' | 'imaginative'; 
  isHighlight: boolean; 
}

export interface MarketingItem {
  id: number;
  date: string;
  propName: string;
  duration: string;
  content: {
    viralTitle?: string;
    socialPost?: string;
    videoScript?: {
      intro: string;
      body: string;
      outro: string;
    };
    storyboard?: Array<{
      seq: number;
      visual: string;
      audio: string;
      duration: string;
      area?: string;
    }>;
  };
}
