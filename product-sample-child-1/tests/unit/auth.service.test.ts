import { AuthService } from '../../src/services/auth/auth.service';
import { JwtService } from '../../src/services/auth/jwt.service';
import { PasswordService } from '../../src/services/auth/password.service';
import { CreateUserDto, UserRole } from '../../src/models/user.model';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let passwordService: PasswordService;
  let userRepository: any;

  beforeEach(() => {
    jwtService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      revokeUserTokens: jest.fn(),
    } as any;

    passwordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    } as any;

    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    authService = new AuthService(jwtService, passwordService, userRepository);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto: CreateUserDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('hashedPassword');
      userRepository.create.mockResolvedValue({
        id: '123',
        ...dto,
        passwordHash: 'hashedPassword',
        isActive: true,
        emailVerified: false,
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.register(dto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
      expect(result.email).toBe(dto.email);
      expect(result.isActive).toBe(true);
    });

    it('should throw error if user already exists', async () => {
      const dto: CreateUserDto = {
        email: 'existing@example.com',
        username: 'existing',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
      };

      userRepository.findByEmail.mockResolvedValue({ id: '123', email: dto.email });

      await expect(authService.register(dto)).rejects.toThrow(
        'User with this email already exists'
      );
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: '123',
        email: loginDto.email,
        passwordHash: 'hashedPassword',
        isActive: true,
        role: UserRole.USER,
      };

      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(true);
      jwtService.generateAccessToken.mockResolvedValue('accessToken');
      jwtService.generateRefreshToken.mockResolvedValue('refreshToken');

      const result = await authService.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive account', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      const mockUser = {
        id: '123',
        email: loginDto.email,
        passwordHash: 'hashedPassword',
        isActive: false,
      };

      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow('Account is disabled');
    });
  });
});