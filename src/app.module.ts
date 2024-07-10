import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { GoogleCloudAIService } from './google.cloud.ai.service';
import { EmailProcessor } from './email.processor';
import { OutlookStrategy } from './outlook.strategy';
import { GoogleStrategy } from './google.strategy';
import { EmailService } from './email.service';
import { SessionSerializer } from './session.serializer';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './users/users.module';
import { UserSchema } from './users/entities/user.entity';
import { MongooseModule } from '@nestjs/mongoose';
import * as dotenv from 'dotenv';


dotenv.config()

console.log('MONGODB_URL:', process.env.MONGODB_URL);
@Module({
  imports: [
    PassportModule.register({ session: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    UsersModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    MongooseModule.forRoot(process.env.MONGODB_URL)
  ],
  controllers: [AppController],
  providers: [
    GoogleCloudAIService,
    EmailProcessor,
    OutlookStrategy,
    GoogleStrategy,
    EmailService,
    SessionSerializer,
  ],
})
export class AppModule {}
