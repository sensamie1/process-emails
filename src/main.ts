import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { engine } from 'express-handlebars';
import flash = require('express-flash');
import * as session from 'express-session';
import * as passport from 'passport';
import * as cookieParser from 'cookie-parser';



dotenv.config();
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.useStaticAssets(join(__dirname, '..', 'public'));
    app.setBaseViewsDir(join(__dirname, '..', 'views'))

    // Set up Handlebars view engine
    app.engine('hbs', engine({
      extname: '.hbs',
      defaultLayout: 'main',
      layoutsDir: join(__dirname, '..', 'views/layouts'), // Directory for layout files
      // partialsDir: join(__dirname, '..', 'views/partials'), // Directory for partials
    }));

    app.setViewEngine('hbs')
  
  // Set up session middleware with a secret key
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 24 hours
  }));

  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(cookieParser());

  
  await app.listen(process.env.PORT || 5000);
}
bootstrap();
