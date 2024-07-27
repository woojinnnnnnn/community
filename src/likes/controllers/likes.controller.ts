import {
  Controller,
  HttpException,
  Param,
  Post,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LikesService } from '../services/likes.service';
import { SuccessInterceptor } from 'src/common/interceptors/success.interceptor';
import { HttpExceptionFilter } from 'src/common/exceptions/http-exception.filter';
import { JwtAuthGuard } from 'src/auth/jwt/jwt.guard';

@UseInterceptors(SuccessInterceptor)
@UseFilters(HttpExceptionFilter)
@Controller('community/:communityId/like')
export class LikesController {
  constructor(private readonly likeService: LikesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async addLike(@Param('communityId') communityId: number, @Req() req) {
    try {
      const userId = req.user.id;
      return this.likeService.addLike(communityId, userId)
    } catch (error) {
      throw new HttpException('Server Error', 500);
    }
  }
}

// 임시 라이크 기능 아직 테스트 안해봄