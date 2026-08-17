import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { Public } from '../common/guards/public.decorator';

@ApiTags('Search')
@Controller('api/v1/search')
export class SearchController {
  constructor(private searchService: SearchService) { }

  @Get('medicines')
  @Public()
  @ApiOperation({
    summary: 'Search medicines with location and filters',
    description: 'Endpoint: GET /api/v1/search/medicines?query=amoxicillin&categoryId=uuid&latitude=6.4281&longitude=3.4214&radius=5000&page=1&limit=10&insuranceId=uuid\n\nQuery Parameters:\n- query (optional): Search text to match medicine names\n- categoryId (optional): Filter by category UUID\n- latitude (optional): User latitude for location-based search\n- longitude (optional): User longitude for location-based search\n- radius (optional): Search radius in meters (default varies)\n- page (optional): Page number for pagination\n- limit (optional): Items per page\n- insuranceId (optional): Insurance provider ID for copay calculation',
  })
  @ApiQuery({ name: 'query', required: false, example: 'amoxicillin' })
  @ApiQuery({ name: 'categoryId', required: false, example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'latitude', required: false, type: Number, example: 6.4281 })
  @ApiQuery({ name: 'longitude', required: false, type: Number, example: 3.4214 })
  @ApiQuery({ name: 'radius', required: false, type: Number, example: 5000 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'insuranceId', required: false, example: '550e8400-e29b-41d4-a716-446655440000' })
  searchMedicines(
    @Query('query') query?: string,
    @Query('categoryId') categoryId?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radius') radius?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('insuranceId') insuranceId?: string,
  ) {
    return this.searchService.searchMedicines(
      query,
      categoryId,
      latitude ? parseFloat(latitude) : undefined,
      longitude ? parseFloat(longitude) : undefined,
      radius ? parseInt(radius) : undefined,
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
      insuranceId,
    );
  }
}
