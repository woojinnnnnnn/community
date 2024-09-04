import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { UpdateNickNameDto } from '../dtos/update.nickname.dto';
import { DeleteUserDto } from '../dtos/delete.user.dto';
import { UpdatePasswordDto } from '../dtos/update.password.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // 닉네임 변경 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async updateNickName(body: UpdateNickNameDto, userId: number) {
    const { nickName } = body;

    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isExistNickName =
      await this.userRepository.findUserByNickName(nickName);
    if (isExistNickName) {
      throw new ConflictException('Nickname already in use');
    }

    await this.userRepository.updateUser(body, user);

    return {
      after_nickName: nickName,
    };
  }

  // 회원 탈퇴 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async deleteUser(userId: number, body: DeleteUserDto) {
    const { password } = body;

    const user = await this.userRepository.findUserByIdWithPasswod(userId);

    if (!user) {
      throw new NotFoundException('User not Found');
    }

    const isPasswordValidated = await bcrypt.compare(password, user.password);
    if (!isPasswordValidated) {
      throw new BadRequestException(`dosen't match Password`);
    }

    await this.userRepository.deleteUser(userId);
  }

  // 사용자 프로필 추가 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async updateProfileImage(userId: number, file: Express.Multer.File) {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User Not Found');
    }
    const imagePath = `/uploads/${file.filename}`;
    return this.userRepository.updateProfileImage(userId, imagePath);
  }

  // 사용자 비밀번호 업데이트 - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async updatePassword(userId: number, body: UpdatePasswordDto) {
    const { password, verifyPassword } = body;

    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(`Not Exist ${user}`);
    }

    if (password !== verifyPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    return await this.userRepository.updatePasswordUser(userId, hashedPassword)
  }
}
