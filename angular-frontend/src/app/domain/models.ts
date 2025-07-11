import {
  GeminiUsageMetadata,
  ModelPricing,
} from '../services/profiles.service';

export abstract class AbstractGeminiModel {
  abstract name: string;
  abstract label: string;
  inputTokenLimit?: number;

  static forModel(modelName: string): AbstractGeminiModel {
    const model = GEMINI_MODELS.find((model) => model.name === modelName);
    if (!model) {
      // TODO Support unknown models
      throw new Error(`Did not find model with name ${modelName}`);
    }
    return model;
  }
  abstract calculatePrice(usage: GeminiUsageMetadata): number;

  toJSON(): string {
    return this.name;
  }
}

export class Gemini25Pro extends AbstractGeminiModel {
  name = 'gemini-2.5-pro-preview-05-06';
  label = 'Gemini 2.5 Pro Preview 05-06';

  private getPricing(promptTokenCount: number): ModelPricing {
    const isOver200k = promptTokenCount > 200000;
    return {
      inputPrice: isOver200k ? 2.5 : 1.25,
      outputPrice: isOver200k ? 15.0 : 10.0,
      contextCachingPrice: isOver200k ? 0.625 : 0.31,
    };
  }

  calculatePrice(usage: GeminiUsageMetadata): number {
    if (!usage.totalTokenCount) {
      return 0;
    }

    const pricing = this.getPricing(usage.promptTokenCount || 0);
    let cost = 0;

    if (usage.promptTokenCount) {
      cost += (usage.promptTokenCount / 1000000) * pricing.inputPrice;
    }
    if (usage.candidatesTokenCount) {
      cost += (usage.candidatesTokenCount / 1000000) * pricing.outputPrice;
    }
    if (usage.cachedContentTokenCount) {
      cost +=
        (usage.cachedContentTokenCount / 1000000) * pricing.contextCachingPrice;
    }
    if (usage.toolUsePromptTokenCount) {
      // Tool use prompt tokens are part of the input tokens
      cost += (usage.toolUsePromptTokenCount / 1000000) * pricing.inputPrice;
    }
    if (usage.thoughtsTokenCount) {
      // Thoughts tokens are part of the output tokens
      cost += (usage.thoughtsTokenCount / 1000000) * pricing.outputPrice;
    }

    return cost;
  }
}

export class Gemini25Flash extends AbstractGeminiModel {
  name = 'gemini-2.5-flash';
  label = 'Gemini 2.5 Flash';

  private getPricing(): ModelPricing {
    return {
      inputPrice: 0.3,
      outputPrice: 2.5,
      contextCachingPrice: 0.075,
    };
  }

  calculatePrice(usage: GeminiUsageMetadata): number {
    if (!usage.totalTokenCount) {
      return 0;
    }

    const pricing = this.getPricing();
    let cost = 0;

    if (usage.promptTokenCount) {
      cost += (usage.promptTokenCount / 1000000) * pricing.inputPrice;
    }
    if (usage.candidatesTokenCount) {
      cost += (usage.candidatesTokenCount / 1000000) * pricing.outputPrice;
    }
    if (usage.cachedContentTokenCount) {
      cost +=
        (usage.cachedContentTokenCount / 1000000) * pricing.contextCachingPrice;
    }
    if (usage.toolUsePromptTokenCount) {
      cost += (usage.toolUsePromptTokenCount / 1000000) * pricing.inputPrice;
    }
    if (usage.thoughtsTokenCount) {
      cost += (usage.thoughtsTokenCount / 1000000) * pricing.outputPrice;
    }

    return cost;
  }
}

export const GEMINI_MODELS: AbstractGeminiModel[] = [
  new Gemini25Pro(),
  new Gemini25Flash(),
];
