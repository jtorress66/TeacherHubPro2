import { pictureCleanerContract } from '@thp/testing';
import { MetadataPictureCleaner } from '../src/images/metadata-picture-cleaner.ts';

pictureCleanerContract('MetadataPictureCleaner', () => new MetadataPictureCleaner());
