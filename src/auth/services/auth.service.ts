import {
  HttpException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SignInRequestDto } from '../dtos/signIn.request.dto';
import { JwtService } from '@nestjs/jwt';
import { Payload } from '../jwt/jwt.payload';
import { UserRepository } from 'src/users/repositories/user.repository';
import { ConfigService } from '@nestjs/config';
import { SignUpRequestDto } from '../dtos/signUp.requst.dto';
import { SignUpVerifyPasswordRequestDto } from 'src/auth/dtos/signUpVerifyPasswordRequest.request.dto';
import { User } from 'src/entities/user.entity';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // 회원 가입 ------------------------------------------------------------------------------------
  async signUp(body: SignUpVerifyPasswordRequestDto) {
    try {
      const { email, nickName, password, verifyPassword } = body;
      const isExistUser = await this.userRepository.findUserByEmail(email);

      if (isExistUser) {
        throw new HttpException(`${email} is Already Exists..`, 409);
      }
      const isExistNickName =
        await this.userRepository.findUserByNickName(nickName);

      if (isExistNickName) {
        throw new HttpException(`${nickName} is Already Exists`, 409);
      }

      if (password !== verifyPassword) {
        throw new HttpException('Passwords do not match', 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const signUpUser: SignUpRequestDto = {
        // 리퀘스트가 아니라 리스폰스 로 바꾸어야함,,
        email,
        nickName,
        password: hashedPassword,
      };

      const user = await this.userRepository.createUser(signUpUser);

      return user.readOnlyData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException('Server Error', 500);
      }
    }
  }

  // 로그인 ------------------------------------------------------------------------------------
  async signIn(body: SignInRequestDto) {
    try {
      const { email, password } = body;

      const user = await this.userRepository.findUserByEmail(email);

      if (!user) {
        throw new HttpException(`Not Exist ${user}`, 404);
      }

      const isPasswordValidated = await bcrypt.compare(password, user.password);

      if (isPasswordValidated) {
        const payload = { id: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken } = await this.createToken(payload);

        await this.userRepository.hashedRefreshToken(user.id, refreshToken);

        return { accessToken, refreshToken };
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException('Server Error', 500);
      }
    }
  }

  // 로그아웃 ------------------------------------------------------------------------------------
  async signOut(id: number) {
    await this.userRepository.signOut(id);
  }

  // 토큰 부여 Ver 1.2 ------------------------------------------------------------------------------------
  async createToken({ id, email, role }: Payload) {
    const payload: Payload = { id, email, role };
    const secret = this.configService.get<string>('JWT_SECRET');

    const accessToken = this.jwtService.sign(payload, {
      secret: secret,
      expiresIn: '1h',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: secret,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // 리프레쉬 토큰 검중 후 재발급.  -----------------------------------------------------------------------------
  async refreshTokens(id: number, refreshToken: string) {
    try {
      const user = await this.userRepository.findUserById(id);

      if (!user) {
        throw new HttpException('User Not Found', 404);
      }

      const isRefreshTokenValid =
        await this.userRepository.validateRefreshToken(id, refreshToken);

      if (!isRefreshTokenValid) {
        throw new HttpException('Valid Faill', 400);
      }

      const payload = { id: user.id, email: user.email, role: user.role };
      const tokens = await this.createToken(payload);

      await this.userRepository.hashedRefreshToken(
        user.id,
        tokens.refreshToken,
      );

      return tokens;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException('Server Error', 500);
      }
    }
  }

  // 소셜 로그인 토큰 부여. ------------------------------------------------------------------------------------
  async createTokensSocialLogin(user: { id: number; email: string; role: string }) {
    await this.userRepository.socialLoginVerified(user.id);

    const tokens = await this.createToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  
    await this.userRepository.hashedRefreshToken(user.id, tokens.refreshToken);
  
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // 이메일 관련 서비스 로직. ------------------------------------------------------------------------------------
  // 인증 코드 생성.
  async generateVerificationCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  // 유효성 검사 후 -> 입력한 이메일로 확인 코드 전송 
  async emailSignUp(body: SignUpVerifyPasswordRequestDto) {
    const { email, password, verifyPassword, nickName } = body;
    const isExistUser = await this.userRepository.findUserByEmail(email)
    
    if(isExistUser) {
      throw new HttpException(`${email} is already exists`, 409)
    }

    if(password !== verifyPassword) {
      throw new HttpException('Password do Not Match', 400)
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await this.userRepository.createUser({
      email,
      nickName,
      password: hashedPassword,
    });

    return newUser;
  }

  // 코드 보내기.
  async sendVerificationCode(user: User) {
    const code = await this.generateVerificationCode()
    user.verificationCode = code;
    await this.userRepository.temporarSaveUser(user)

    await this.emailService.sendVerificationToEmail(user.email, code)
  }

  // 코드 확인 함수
  async verifyEmail(email: string, code: string) {
    const user = await this.userRepository.findUserByEmail(email)

    if(!user) {
      throw new HttpException('User Not Found', 404)
    }

    if(user.verificationCode !== code) {
      throw new HttpException('Invalid Verificaion code', 400)
    }

    user.isVerfied = true;
    user.verificationCode = null;
    await this.userRepository.temporarSaveUser(user)
  }
}
