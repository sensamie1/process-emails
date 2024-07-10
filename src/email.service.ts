import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { UsersService } from './users/users.service';
import { LanguageServiceClient, protos } from '@google-cloud/language';

@Injectable()
export class EmailService {
  private gmailClient: any;
  private outlookClient: any;
  private languageClient: LanguageServiceClient;

  constructor(private readonly userService: UsersService) {
    // Set up Gmail client
    const auth = new google.auth.OAuth2({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_CALLBACK_URL,
    });
    this.gmailClient = google.gmail({ version: 'v1', auth });

    // Set up Outlook client
    this.outlookClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.OUTLOOK_CLIENT_ID,
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
        authority: 'https://login.microsoftonline.com/common',
      },
    });

    // Initialize Google Cloud Natural Language client
    this.languageClient = new LanguageServiceClient();
  }

  async fetchEmails(service: 'gmail' | 'outlook', email: string): Promise<any[]> {
    const user = await this.userService.findOne(email);
    if (service === 'gmail' && user.googleAccessToken) {
      return await this.fetchGmailEmails(user.googleAccessToken);
    } else if (service === 'outlook' && user.outlookAccessToken) {
      return await this.fetchOutlookEmails(user.outlookAccessToken);
    }
    return [];
  }

  private async fetchGmailEmails(accessToken: string): Promise<any[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const gmailClient = google.gmail({ version: 'v1', auth });

    const res = await gmailClient.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'is:unread',
    });
    const messages = res.data.messages || [];
    const emails = await Promise.all(messages.map(async message => {
      const email = await gmailClient.users.messages.get({ userId: 'me', id: message.id });
      const fromHeader = email.data.payload.headers.find(header => header.name === 'From')
      return {
        id: email.data.id,
        content: email.data.snippet,
        from: fromHeader.value
      };
    }));
    return emails;
  }

  private async fetchOutlookEmails(accessToken: string): Promise<any[]> {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    const messages = await client.api('/me/messages')
      .filter('isRead ne true') 
      .top(10)
      .get();
      // const fromHeader = messages.data.payload.headers.find(header => header.name === 'From')
      const emails = messages.value.map(message => ({
        id: message.id,
        content: message.bodyPreview,
        from: message.from.emailAddress.address
        
      }));
    return emails;
  }

  async labelGmailEmail(userEmail: string, emailId: string, category: string) {
    const user = await this.userService.findOne(userEmail);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: user.googleAccessToken });
    const gmailClient = google.gmail({ version: 'v1', auth });
  
    let labelName;
    switch (category) {
      case 'Interested':
        labelName = 'Interested';
        break;
      case 'Not Interested':
        labelName = 'NotInterested';
        break;
      case 'More Information':
        labelName = 'MoreInfo';
        break;
      default:
        throw new Error('Invalid category');
    }
  
    const labelId = await this.getOrCreateLabel(gmailClient, labelName);
  
    await gmailClient.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }
  
  private async getOrCreateLabel(gmailClient: any, labelName: string): Promise<string> {
    const labelsRes = await gmailClient.users.labels.list({ userId: 'me' });
    const labels = labelsRes.data.labels;
  
    let label = labels.find((label: any) => label.name === labelName);
  
    if (!label) {
      const createLabelRes = await gmailClient.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      label = createLabelRes.data;
    }
  
    return label.id;
  }
  

  async labelOutlookEmail(userEmail: string, emailId: string, category: string) {
    const user = await this.userService.findOne(userEmail);
    const client = Client.init({
      authProvider: (done) => {
        done(null, user.outlookAccessToken);
      },
    });

    let categoryLabel;
    switch (category) {
      case 'Interested':
        categoryLabel = 'Interested';
        break;
      case 'Not Interested':
        categoryLabel = 'NotInterested';
        break;
      case 'More Information':
        categoryLabel = 'MoreInfo';
        break;
    }

    await client.api(`/me/messages/${emailId}`)
      .update({
        categories: [categoryLabel],
      });
  }

  async sendResponse(email: any, response: any) {
    const user = await this.userService.findOne(email.userId);
    if (email.service === 'gmail') {
      await this.sendGmailResponse(email, response, user.googleAccessToken);
    } else if (email.service === 'outlook') {
      await this.sendOutlookResponse(email, response, user.outlookAccessToken);
    }
  }

  private async sendGmailResponse(email: any, response: string, accessToken: string) {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const gmailClient = google.gmail({ version: 'v1', auth });

      const rawMessage = this.createGmailRawMessage(email.from, response);

      await gmailClient.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage,
        },
      });
    } catch (error) {
      console.error('Error sending Gmail response:', error);
      throw new Error('Failed to send Gmail response');
    }
  }

  private async sendOutlookResponse(email: any, response: string, accessToken: string) {
    try {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      await client.api('/me/sendMail')
        .post({
          message: {
            subject: 'Automated Response',
            body: {
              contentType: 'Text',
              content: response,
            },
            toRecipients: [{
              emailAddress: {
                address: email.from,
              },
            }],
          },
        });
    } catch (error) {
      console.error('Error sending Outlook response:', error);
      throw new Error('Failed to send Outlook response');
    }
  }

  private createGmailRawMessage(to: string, response: string): string {
    const messageParts = [
      `To: ${to}`,
      'Subject: Automated Response',
      '',
      response,
    ];
    const message = messageParts.join('\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async markGmailEmailAsRead(userEmail: string, emailId: string,) {
    const user = await this.userService.findOne(userEmail);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: user.googleAccessToken });
    const gmailClient = google.gmail({ version: 'v1', auth });
    await gmailClient.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  async markOutlookEmailAsRead(userEmail: string, emailId: string,) {
    const user = await this.userService.findOne(userEmail);
    const client = Client.init({
      authProvider: (done) => {
        done(null, user.outlookAccessToken);
      },
    });

    await client.api(`/me/messages/${emailId}/extensions`).post({
      extensionName: 'Microsoft.OutlookServices.OpenTypeExtension.Composer', // Extension for marking as read
      extensionValue: {
        isRead: true,
      },
    });
  }

  // async analyzeSentiment(text: string): Promise<any> {
  //   const document = {
  //     content: text,
  //     type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT,
  //   };

  //   const [result] = await this.languageClient.analyzeSentiment({ document });
  //   return result;
  // }

  // getCategoryFromSentiment(sentiment: any): string {
  //   if (sentiment.documentSentiment.score > 0.20) {
  //     return 'Interested';
  //   } else if (sentiment.documentSentiment.score < -0.20) {
  //     return 'Not Interested';
  //   } else {
  //     return 'More Information';
  //   }
  // }

  // async generateResponse(category: string): Promise<string> {
  //   if (category === 'Interested') {
  //     return 'Thank you for your interest! We will get back to you soon.';
  //   } else if (category === 'Not Interested') {
  //     return 'Thank you for your response. Have a great day!';
  //   } else if (category === 'More Information') {
  //     return 'Could you please provide more information? Thank you!';
  //   }
  // }
}
