import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommentRepositoty } from '../repositories/comment.repository';
import { CreateCommentDto } from '../dtos/create.comment.dto';
import { UserRepository } from 'src/users/repositories/user.repository';
import { BoardRepository } from 'src/boards/repositories/board.repository';
import { Comment } from 'src/entities/comment.entity';
import { User } from 'src/entities/user.entity';
import { CommentResponseDto } from '../dtos/response.comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepositoty,
    private readonly userRepository: UserRepository,
    private readonly boardRepository: BoardRepository,
  ) {}

  // 댓글 및 대댓글 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async createComment(id: number, body: CreateCommentDto, userId: number) {
    try {
      const board = await this.boardRepository.findOneBoardId(id);

      if (!board) {
        throw new HttpException(`Board with id ${id} not found`, 404);
      }

      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        throw new HttpException(`User with id ${userId} not found`, 404);
      }

      const newComment = new Comment();
      newComment.board = board;
      newComment.content = body.content;
      newComment.user = {
        id: user.id,
        email: user.email,
        nickName: user.nickName,
        role: user.role,
      } as any;

      // 여기서 부모 댓글.
      if (body.replyToId) {
        const replyTo = await this.commentRepository.findOne(body.replyToId);
        if (!replyTo) {
          throw new HttpException(
            `Parent comment with id ${body.replyToId} not found`,
            404,
          );
        }
        newComment.replyTo = replyTo;
      }

      const savedComment =
        await this.commentRepository.createComment(newComment);
      return new CommentResponseDto(savedComment);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException('Server Error', 500);
      }
    }
  }

  // 커뮤니티 id 를 통한 댓글 조회 (전체 조회)- - - - - - - - - - - - - - - - - - - - - - - - - - -
  async getCommentByBoardId(id: number) {
    try {
      return this.commentRepository.findCommentByBoardId(id);
    } catch (error) {
      throw new HttpException('Server Error', 500);
    }
  }

  // 댓글 삭제 - - - - - - - - - - - - - - - - - - - - - - - - - - -
  async deleteComment(id: number, userId: number) {
    try {
      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        throw new HttpException('User Not Found', 404);
      }
      if (!id) {
        throw new HttpException(`${id}, Not Found`, 404);
      }

      if (user.id !== userId) {
        throw new HttpException(
          'You Do Not Have Permission To Edit This Comment',
          403,
        );
      }

      const deleteComment = await this.commentRepository.deleteComment(
        id,
        user,
      );

      return {
        id: deleteComment.id,
        content: deleteComment.content,
        userId: deleteComment.user.id,
        email: deleteComment.user.email,
        nickName: deleteComment.user.nickName,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException('Server error', 500);
      }
    }
  }
}