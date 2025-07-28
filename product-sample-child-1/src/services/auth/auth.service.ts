import { User, CreateUserDto } from '../../models/user.model';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  constructor(
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private userRepository: any // Replace with actual repository
  ) {}

  async register(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    
    const user = await this.userRepository.create({
      ...dto,
      passwordHash,
      isActive: true,
      emailVerified: false,
    });

    return user;
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.passwordService.verify(
      dto.password,
      user.passwordHash!
    );

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    const tokens = await this.generateTokens(user);
    
    await this.userRepository.updateLastLogin(user.id);
    
    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.jwtService.verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(payload.userId);
    
    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    // Invalidate refresh tokens for the user
    await this.jwtService.revokeUserTokens(userId);
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.generateAccessToken(payload);
    const refreshToken = await this.jwtService.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour
    };
  }
}