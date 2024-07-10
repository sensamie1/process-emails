import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Request, Response } from 'express';
import { UsersService } from './users/users.service';

@Injectable()
export class OutlookStrategy extends PassportStrategy(Strategy, 'outlook') {
  private msalClient: ConfidentialClientApplication;

  constructor(private readonly userService: UsersService) {
    super();
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.OUTLOOK_CLIENT_ID,
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET_VALUE,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
  }

  async validate(req: Request, res: Response, done: Function) {
    const authCodeUrlParameters = {
      scopes: ['openid', 'profile', 'email', 'Mail.Read', 'Mail.Send'],
      redirectUri: 'http://localhost:5000/auth/outlook/callback',
    };

    try {
      const authCodeUrl = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
      res.redirect(authCodeUrl);
    } catch (error) {
      done(error, false);
    }
  }

  async handleCallback(req: Request, res: Response, done: Function) {
    const tokenRequest = {
      code: req.query.code as string,
      scopes: ['openid', 'profile', 'email', 'Mail.Read', 'Mail.Send'],
      redirectUri: 'http://localhost:5000/auth/outlook/callback',
    };

    try {
      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      const email = response.account.username;

      let user = await this.userService.findOne(email);
      if (!user) {
        user = await this.userService.create({
          email,
          outlookAccessToken: response.accessToken,
          // outlookRefreshToken: response.refreshToken,
        });
        console.log("User created", user);
      } else {
        user = await this.userService.update(email, {
          outlookAccessToken: response.accessToken,
          // outlookRefreshToken: response.refreshToken,
        });
        console.log("User updated", user);
      }

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}