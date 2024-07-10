import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { InjectQueue } from '@nestjs/bull';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { OutlookStrategy } from './outlook.strategy';
import { GoogleCloudAIService } from './google.cloud.ai.service';
import { EmailService } from './email.service';
// import { EmailProcessor } from './email.processor';
import { UsersService } from './users/users.service';

@Controller()
export class AppController {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly outlookStrategy: OutlookStrategy,
    private readonly googleCloudAIService: GoogleCloudAIService,
    private readonly emailService: EmailService,
    // private readonly emailProcessor: EmailProcessor,
    private readonly userService: UsersService,
  ) {}

  @Get()
  getHello(): string {
    return 'Welcome to Process Emails!';
  }

  @Get('connect')
  getConnectPage(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    const message = req.flash('info');
    return res.render('connect', { user: user, message: message });
  }
  @Get('privacy-policy')
  getPrivacyPolicy(@Req() req: Request, @Res() res: Response) {
    return res.render('privacy-policy');
  }


  @Get('auth/google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Initiates Google OAuth flow
  }

  @Get('auth/google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    req.flash('info', 'You have successfully connected your Google account.');
    console.log({
      message: "Authenticated",
      user
    });
    res.redirect('/connect');
  }

  @Get('auth/outlook')
  async outlookAuth(@Req() req: Request, @Res() res: Response) {
    await this.outlookStrategy.validate(req, res, (err, user) => {
      if (err) {
        console.log(err);
        return res.redirect('/connect');
      }
      req.logIn(user, err => {
        if (err) {
          console.log(err);
          return res.redirect('/connect');
        }
        console.log({
          message: 'Authenticated',
          user,
        });
        req.flash('info', 'You have successfully connected your Outlook account.');
        res.redirect('/connect');
      });
    });
  }

  @Get('auth/outlook/callback')
  async outlookAuthCallback(@Req() req: Request, @Res() res: Response) {
    await this.outlookStrategy.handleCallback(req, res, (err, user) => {
      if (err) {
        console.log(err);
        return res.redirect('/connect');
      }
      req.logIn(user, err => {
        if (err) {
          console.log(err);
          return res.redirect('/connect');
        }
        console.log({
          message: 'Authenticated',
          user,
        });
        req.flash('info', 'You have successfully connected your Outlook account.');
        res.redirect('/connect');
      });
    });
  }


  @Cron('*/1 * * * *')  // Schedule to run every minute
  async processEmails() {
    console.log('Running scheduled email processing job');
    const users = await this.userService.findAll();
    if (!users || users.length === 0) {
      return console.log({ message: "No users found." });
    }

    for (const user of users) {
      // Fetch and process emails from Gmail
      if (user.googleAccessToken) {
        try {
          const gmailEmails = await this.emailService.fetchEmails('gmail', user.email);
          if (gmailEmails.length === 0) {
            console.log({ message: "No unread Gmail emails to process." });
            continue;
          }
          for (const email of gmailEmails) {
            await this.processEmail('gmail', user.email, email);
          }
        } catch (error) {
          console.error(`Error fetching Gmail emails for user ${user.email}:`, error);
        }
      }

      // Fetch and process emails from Outlook
      if (user.outlookAccessToken) {
        try {
          const outlookEmails = await this.emailService.fetchEmails('outlook', user.email);
          if (outlookEmails.length === 0) {
            console.log({ message: "No unread Outlook emails to process." });
            continue;
          }
          for (const email of outlookEmails) {
            await this.processEmail('outlook', user.email, email);
          }
        } catch (error) {
          console.error(`Error fetching Outlook emails for user ${user.email}:`, error);
        }
      }
    }

    console.log('Email processing job completed.');
  }

  private async processEmail(service: 'gmail' | 'outlook', userEmail: string, email: any) {
    const sentiment = await this.googleCloudAIService.analyzeSentiment(email.content);
    console.log(sentiment);
    const category = this.googleCloudAIService.getCategoryFromSentiment(sentiment);
    console.log(category);
    const response = await this.googleCloudAIService.generateResponse(category);
    console.log(email);
    // const sentiment = await this.emailService.analyzeSentiment(email.content);
    // console.log(sentiment);
    // const category = this.emailService.getCategoryFromSentiment(sentiment);
    // console.log(category);
    // const response = await this.emailService.generateResponse(category);
    // console.log(email);

    await this.emailService.sendResponse({
      service,
      emailId: email.id,
      from: email.from,
      userId: userEmail,
    }, response);

    if (service === 'gmail') {
      await this.emailService.labelGmailEmail(userEmail, email.id, category);
      await this.emailService.markGmailEmailAsRead(userEmail, email.id);
    } else if (service === 'outlook') {
      await this.emailService.labelOutlookEmail(userEmail, email.id, category);
      await this.emailService.markOutlookEmailAsRead(userEmail, email.id);
    }
  }

}
