import { IConfigService, IEmojiService } from "../types/services";

export class EmojiService implements IEmojiService {
  private static instance: EmojiService;
  private emojis: string[];
  private configService: IConfigService;

  private constructor(configService: IConfigService) {
    this.configService = configService;
    this.emojis = configService.getCustomEmojis();
  }

  public static getInstance(configService?: IConfigService): EmojiService {
    if (!EmojiService.instance && configService) {
      EmojiService.instance = new EmojiService(configService);
    }
    return EmojiService.instance;
  }

  public getRandomEmoji(): string {
    if (this.emojis.length === 0) {
      return "🔍";
    }
    const randomIndex = Math.floor(Math.random() * this.emojis.length);
    return this.emojis[randomIndex];
  }

  public getEmojiCount(): number {
    return this.emojis.length;
  }

  public updateEmojis(emojis: string[]): void {
    this.emojis = emojis.length > 0 ? emojis : this.configService.getCustomEmojis();
  }
}
