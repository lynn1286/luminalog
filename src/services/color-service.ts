import { IColorService, ColorInfo, ColorStyle } from "../types/services";
import { IConfigService } from "../types/services";

export class ColorService implements IColorService {
  private colors: string[];
  private configService: IConfigService;

  constructor(configService: IConfigService) {
    this.configService = configService;
    this.colors = configService.getCustomColors();
  }

  public generateRandomColor(): ColorInfo {
    if (this.colors.length === 0) {
      return {
        backgroundColor: "#4ECDC4",
        textColor: "black",
        luminance: 0.6,
      };
    }

    const randomIndex = Math.floor(Math.random() * this.colors.length);
    const backgroundColor = this.colors[randomIndex];
    const luminance = this.calculateLuminance(backgroundColor);
    const textColor = luminance > 0.5 ? "black" : "white";

    return {
      backgroundColor,
      textColor,
      luminance,
    };
  }

  private calculateLuminance(hexColor: string): number {
    // 移除 # 号
    const hex = hexColor.replace("#", "");

    // 转换为 RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // 计算相对亮度（简化版）
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }

  public updateColors(colors: string[]): void {
    this.colors = colors.length > 0 ? colors : this.configService.getCustomColors();
  }

  public formatColorStyle(color: ColorInfo, fontSize: number, quote: string): ColorStyle {
    return {
      key: "%c ",
      value: `${quote}font-size:${fontSize}px;background-color:${color.backgroundColor};color:${color.textColor};${quote}, `,
      space: " ",
    };
  }
}
