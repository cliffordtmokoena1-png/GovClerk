declare global {
  interface Window {
    Rewardful?: RewardfulObject;
  }
}

interface RewardfulObject {
  referral: string;
}

export {};
