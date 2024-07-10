import { Injectable } from '@nestjs/common';
import { LanguageServiceClient, protos } from '@google-cloud/language';
// import * as dialogflow from '@google-cloud/dialogflow';
// import * as uuid from 'uuid';
// import * as path from 'path';

@Injectable()
export class GoogleCloudAIService {
  private languageClient: LanguageServiceClient;
  // private dialogflowClient: dialogflow.SessionsClient;
  // private projectId: string;
  private keywords: { [key: string]: string[] };

  constructor() {
    this.languageClient = new LanguageServiceClient();
    // this.dialogflowClient = new dialogflow.SessionsClient();
    // this.projectId = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    this.keywords = {
      'Interested': ['interested', 'excited', 'looking forward', 'keen', 'attentive', 'intent', 'focused', 'absorbed', 'engrossed', 'fascinated', 'riveted', 'gripped', 'captivated', 'rapt', 'agog', 'intrigued', 'inquiring', 'inquisitive', 'curious', 'burning with', 'curiosity', 'earnest', 'keen', 'eager', 'all ears', 'beady-eyed', 'nosy', 'snoopy'],
      'Not Interested': ['not interested', 'no thanks', 'uninterested', 'decline', 'indifferent', 'indifferent to', 'unconcerned about', 'uninvolved', 'uninvolved in', 'uninvolved with', 'incurious', 'incurious about', 'apathy', 'apathetic', 'apathetic towards', 'bored', 'bored by', 'unmoved', 'unmoved by', 'unresponsive', 'unresponsive to', 'blasé', 'nonchalant', 'lukewarm', 'unenthusiastic', 'phlegmatic', 'impassive', 'dispassionate', 'aloof', 'detached', 'distant'],
      'More Information': ['more information', 'details', 'clarify', 'explain'],
    };
  }

  async analyzeSentiment(text: string): Promise<any> {
    const document = {
      content: text,
      type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT,
    };

    const [result] = await this.languageClient.analyzeSentiment({ document });
    return result;
  }

  getCategoryFromSentiment(sentiment: any): string {
    const sentences = sentiment.sentences || [];

    for (const sentence of sentences) {
      const text = sentence.text.content.toLowerCase();
      if (this.containsKeywords(text, this.keywords['Not Interested'])) {
        return 'Not Interested';
      } if (this.containsKeywords(text, this.keywords['Interested'])) {
        return 'Interested';
      } else {
        return 'More Information';
      }
    }

    const sentimentScore = sentiment.documentSentiment.score;
    if (sentimentScore > 0.20) {
      return 'Interested';
    } else if (sentimentScore < -0.20) {
      return 'Not Interested';
    } else {
      return 'More Information';
    }
  }

  // Function to check if text contains any of the keywords
  containsKeywords(text: string, keywords: string[]): boolean {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  async generateResponse(category: string): Promise<string> {

    const currentDate = new Date();

    // Calculate future dates
    const futureDate2 = new Date(currentDate);
    futureDate2.setDate(currentDate.getDate() + 2);
  
    const futureDate4 = new Date(currentDate);
    futureDate4.setDate(currentDate.getDate() + 4);
  
    const futureDate6 = new Date(currentDate);
    futureDate6.setDate(currentDate.getDate() + 6);
  
    // Format dates as strings (adjust the format as needed)
    const formattedDate2 = futureDate2.toISOString().slice(0, 10);
    const formattedDate4 = futureDate4.toISOString().slice(0, 10);
    const formattedDate6 = futureDate6.toISOString().slice(0, 10);
    if (category === 'Interested') {
      return  `Thank You for Your Interest! 
      Thank you for expressing your interest in our services! We are thrilled to hear that you are keen on learning more about what we offer.
      
      To provide you with a comprehensive understanding of how we can assist you, would you be available for a demo call? Here are a few suggested times:

      Option 1: ${formattedDate2}

      Option 2: ${formattedDate4}
      
      Option 3: ${formattedDate6}

      Please let us know which time works best for you, or suggest an alternative if none of these times are convenient. We look forward to discussing how we can support your needs, assist you and help you achieve your goals.
      
      Best regards!`
    } else if (category === 'Not Interested') {
      return  `Thank you for taking the time to respond!
      We appreciate your honesty and feedback. We understand that our services may not be what you are looking for at this time. Should your needs change in the future, please do not hesitate to reach out to us. We are always here to help.
    
      Wishing you all the best in your endeavors.
      
      Kind regards!`
    } else if (category === 'More Information') {
      return `Thank you for reaching out to us!
        
      We would be happy to provide you with more information about our services.

      Could you please specify the details or areas you would like more information about? This will help us provide you with the most relevant and helpful details.

      Thank you for your interest, and we look forward to assisting you further.

      Best regards,`
      }
    }

  // async categorizeEmail(content: string): Promise<string> {
  //   const document = {
  //     content: content,
  //     type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT,
  //   };

  //   const [result] = await this.languageClient.analyzeSentiment({ document });
  //   const sentiment = result.documentSentiment;

  //   if (sentiment.score > 0.25) {
  //     return 'Interested';
  //   } else if (sentiment.score < -0.25) {
  //     return 'Not Interested';
  //   } else {
  //     return 'More Information';
  //   }
  // }

  // async generateResponse(category: string): Promise<string> {
  //   const sessionId = uuid.v4();
  //   const sessionPath = this.dialogflowClient.projectAgentSessionPath(this.projectId, sessionId);

  //   const responses = {
  //     'Interested': 'Thank you for your interest! We will get back to you shortly.',
  //     'Not Interested': 'Thank you for your time. If you change your mind, feel free to reach out.',
  //     'More Information': 'Can you please provide more details so we can assist you better?',
  //   };

  //   const request = {
  //     session: sessionPath,
  //     queryInput: {
  //       text: {
  //         text: responses[category],
  //         languageCode: 'en-US',
  //       },
  //     },
  //   };

  //   const [response] = await this.dialogflowClient.detectIntent(request);
  //   return response.queryResult.fulfillmentText;
  // }
}
