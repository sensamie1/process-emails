import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOne(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async create(user: Partial<User>): Promise<User> {
    const createdUser = new this.userModel(user);
    return createdUser.save();
  }

  async update(email: string, update: Partial<User>): Promise<User> {
    return this.userModel.findOneAndUpdate({ email }, update, { new: true }).exec();
  }
}
