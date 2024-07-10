import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = User & mongoose.Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  googleAccessToken: string;

  @Prop()
  googleRefreshToken: string;

  @Prop()
  outlookAccessToken: string;

  @Prop()
  outlookRefreshToken: string;
}


export const UserSchema = SchemaFactory.createForClass(User);

// Export the User model
export const UserModel = mongoose.model<UserDocument>('User', UserSchema);
