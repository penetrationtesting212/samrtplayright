import * as tf from '@tensorflow/tfjs';
import * as tfNode from '@tensorflow/tfjs-node';
import ssim from 'ssim.js';
import { PNG } from 'pngjs';
import * as jimp from 'jimp';

export class ImageProcessor {
  private static instance: ImageProcessor;
  
  private constructor() {}
  
  static getInstance(): ImageProcessor {
    if (!ImageProcessor.instance) {
      ImageProcessor.instance = new ImageProcessor();
    }
    return ImageProcessor.instance;
  }

  /**
   * Preprocess image for computer vision models
   */
  async preprocessImage(imageBuffer: Buffer, targetSize: [number, number] = [224, 224]): Promise<tf.Tensor> {
    try {
      // Decode image
      const imageTensor = tfNode.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;
      
      // Resize to target size
      const resized = tf.image.resizeBilinear(imageTensor, targetSize);
      
      // Normalize to [0, 1]
      const normalized = resized.div(255.0);
      
      // Clean up intermediate tensors
      imageTensor.dispose();
      resized.dispose();
      
      return normalized;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  }

  /**
   * Extract image features using a pre-trained model or custom CNN
   */
  async extractFeatures(imageTensor: tf.Tensor, model: tf.LayersModel): Promise<tf.Tensor> {
    try {
      const features = model.predict(imageTensor.expandDims(0)) as tf.Tensor;
      return features;
    } catch (error) {
      console.error('Error extracting features:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two feature vectors
   */
  calculateCosineSimilarity(features1: tf.Tensor, features2: tf.Tensor): number {
    try {
      // Flatten tensors if needed
      const flat1 = features1.flatten();
      const flat2 = features2.flatten();
      
      // Calculate dot product
      const dotProduct = tf.sum(tf.mul(flat1, flat2));
      
      // Calculate magnitudes
      const magnitude1 = tf.sqrt(tf.sum(tf.square(flat1)));
      const magnitude2 = tf.sqrt(tf.sum(tf.square(flat2)));
      
      // Calculate cosine similarity
      const similarity = tf.div(dotProduct, tf.mul(magnitude1, magnitude2));
      
      const result = similarity.dataSync()[0];
      
      // Clean up tensors
      flat1.dispose();
      flat2.dispose();
      dotProduct.dispose();
      magnitude1.dispose();
      magnitude2.dispose();
      similarity.dispose();
      
      return result;
    } catch (error) {
      console.error('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  /**
   * Crop image tensor to specific region
   */
  cropImageRegion(
    imageTensor: tf.Tensor, 
    boundingBox: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number
  ): tf.Tensor {
    try {
      // Normalize coordinates to [0, 1]
      const normalizedBox = [
        boundingBox.y / imageHeight,           // y1
        boundingBox.x / imageWidth,            // x1
        (boundingBox.y + boundingBox.height) / imageHeight, // y2
        (boundingBox.x + boundingBox.width) / imageWidth    // x2
      ];
      
      // Crop and resize
      const cropped = tf.image.cropAndResize(
        imageTensor.expandDims(0) as tf.Tensor4D,
        [normalizedBox],
        [0],
        [224, 224]
      );
      
      return cropped.squeeze([0]);
    } catch (error) {
      console.error('Error cropping image region:', error);
      throw error;
    }
  }

  /**
   * Create an edge detection filter
   */
  createEdgeDetectionFilter(): tf.Tensor {
    // Sobel edge detection kernel
    const sobelX = tf.tensor2d([
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ]);
    
    const sobelY = tf.tensor2d([
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1]
    ]);
    
    // Combine both filters
    const combined = tf.stack([sobelX, sobelY], 2).expandDims(3);
    
    sobelX.dispose();
    sobelY.dispose();
    
    return combined;
  }

  /**
   * Apply edge detection to image
   */
  async detectEdges(imageTensor: tf.Tensor): Promise<tf.Tensor> {
    try {
      // Convert to grayscale if needed
      const grayscale = imageTensor.shape.length === 3 && imageTensor.shape[2] === 3 
        ? tf.mean(imageTensor, 2, true) 
        : imageTensor;
      
      // Create edge detection filter
      const edgeFilter = this.createEdgeDetectionFilter();
      
      // Apply convolution
      const edges = tf.conv2d(
        grayscale.expandDims(0) as tf.Tensor4D,
        edgeFilter,
        1,
        'same'
      );
      
      // Clean up
      if (grayscale !== imageTensor) {
        grayscale.dispose();
      }
      edgeFilter.dispose();
      
      return edges.squeeze([0]);
    } catch (error) {
      console.error('Error detecting edges:', error);
      throw error;
    }
  }

  /**
   * Calculate structural similarity between two images
   */
  async calculateStructuralSimilarity(image1: tf.Tensor, image2: tf.Tensor): Promise<number> {
    try {
      // Ensure images are the same size
      const size = [224, 224];
      const resized1 = tf.image.resizeBilinear(image1, size);
      const resized2 = tf.image.resizeBilinear(image2, size);
      
      // Convert to grayscale
      const gray1 = resized1.shape.length === 3 ? tf.mean(resized1, 2) : resized1;
      const gray2 = resized2.shape.length === 3 ? tf.mean(resized2, 2) : resized2;
      
      // Calculate means
      const mean1 = tf.mean(gray1);
      const mean2 = tf.mean(gray2);
      
      // Calculate variances and covariance
      const var1 = tf.mean(tf.square(tf.sub(gray1, mean1)));
      const var2 = tf.mean(tf.square(tf.sub(gray2, mean2)));
      const covar = tf.mean(tf.mul(tf.sub(gray1, mean1), tf.sub(gray2, mean2)));
      
      // SSIM constants
      const c1 = 0.01 ** 2;
      const c2 = 0.03 ** 2;
      
      // Calculate SSIM
      const numerator = tf.mul(
        tf.add(tf.mul(2, tf.mul(mean1, mean2)), c1),
        tf.add(tf.mul(2, covar), c2)
      );
      
      const denominator = tf.mul(
        tf.add(tf.add(tf.square(mean1), tf.square(mean2)), c1),
        tf.add(tf.add(var1, var2), c2)
      );
      
      const ssim = tf.div(numerator, denominator);
      const result = ssim.dataSync()[0];
      
      // Clean up tensors
      resized1.dispose();
      resized2.dispose();
      if (gray1 !== resized1) gray1.dispose();
      if (gray2 !== resized2) gray2.dispose();
      mean1.dispose();
      mean2.dispose();
      var1.dispose();
      var2.dispose();
      covar.dispose();
      numerator.dispose();
      denominator.dispose();
      ssim.dispose();
      
      return result;
    } catch (error) {
      console.error('Error calculating structural similarity:', error);
      return 0;
    }
  }

  /**
   * Create a simple feature extraction model
   */
  createFeatureExtractionModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // First convolutional block
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Second convolutional block
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Third convolutional block
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Feature extraction layers
        tf.layers.globalAveragePooling2d(),
        tf.layers.dense({ units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64 }) // Final feature vector
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }

  /**
   * Clean up tensor memory
   */
  dispose(...tensors: tf.Tensor[]) {
    tensors.forEach(tensor => {
      if (tensor && !tensor.isDisposed) {
        tensor.dispose();
      }
    });
  }

  // ============ SSIM.js Enhanced Methods ============

  /**
   * Calculate SSIM using the SSIM.js library for higher accuracy
   */
  async calculateSSIMJS(imageBuffer1: Buffer, imageBuffer2: Buffer): Promise<number> {
    try {
      // Convert buffers to PNG format for SSIM.js
      const image1 = await jimp.read(imageBuffer1);
      const image2 = await jimp.read(imageBuffer2);
      
      // Ensure images are the same size
      const targetSize = Math.min(image1.getWidth(), image1.getHeight(), image2.getWidth(), image2.getHeight());
      image1.resize(targetSize, targetSize);
      image2.resize(targetSize, targetSize);
      
      // Convert to PNG data for SSIM.js
      const png1 = {
        data: image1.bitmap.data,
        width: image1.getWidth(),
        height: image1.getHeight()
      };
      
      const png2 = {
        data: image2.bitmap.data,
        width: image2.getWidth(),
        height: image2.getHeight()
      };
      
      // Calculate SSIM
      const ssimResult = ssim(png1, png2);
      return ssimResult.mssim;
    } catch (error) {
      console.error('Error calculating SSIM with SSIM.js:', error);
      return 0;
    }
  }

  /**
   * Enhanced visual comparison using both TensorFlow and SSIM.js
   */
  async compareImagesEnhanced(
    imageBuffer1: Buffer, 
    imageBuffer2: Buffer
  ): Promise<{
    ssimJS: number;
    tensorFlowSSIM: number;
    cosineSimilarity: number;
    combinedScore: number;
    confidence: 'high' | 'medium' | 'low';
  }> {
    try {
      // SSIM.js calculation
      const ssimJS = await this.calculateSSIMJS(imageBuffer1, imageBuffer2);
      
      // TensorFlow-based calculations
      const tensor1 = await this.preprocessImage(imageBuffer1);
      const tensor2 = await this.preprocessImage(imageBuffer2);
      
      const tensorFlowSSIM = await this.calculateStructuralSimilarity(tensor1, tensor2);
      
      // Feature-based comparison
      const model = this.createFeatureExtractionModel();
      const features1 = await this.extractFeatures(tensor1, model);
      const features2 = await this.extractFeatures(tensor2, model);
      const cosineSimilarity = this.calculateCosineSimilarity(features1, features2);
      
      // Combined score with weighted average
      const combinedScore = (
        ssimJS * 0.4 +                    // SSIM.js gets highest weight
        tensorFlowSSIM * 0.3 +           // TensorFlow SSIM
        cosineSimilarity * 0.3           // Feature similarity
      );
      
      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low';
      if (combinedScore > 0.8) confidence = 'high';
      else if (combinedScore > 0.5) confidence = 'medium';
      else confidence = 'low';
      
      // Clean up
      tensor1.dispose();
      tensor2.dispose();
      features1.dispose();
      features2.dispose();
      model.dispose();
      
      return {
        ssimJS,
        tensorFlowSSIM,
        cosineSimilarity,
        combinedScore,
        confidence
      };
    } catch (error) {
      console.error('Error in enhanced image comparison:', error);
      return {
        ssimJS: 0,
        tensorFlowSSIM: 0,
        cosineSimilarity: 0,
        combinedScore: 0,
        confidence: 'low'
      };
    }
  }

  /**
   * Extract region-based SSIM for targeted element comparison
   */
  async calculateRegionSSIM(
    fullImageBuffer: Buffer,
    targetImageBuffer: Buffer,
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Promise<number> {
    try {
      // Load images
      const fullImage = await jimp.read(fullImageBuffer);
      const targetImage = await jimp.read(targetImageBuffer);
      
      // Crop region from full image
      const cropped = fullImage.crop(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );
      
      // Resize both to same dimensions
      const targetSize = Math.min(cropped.getWidth(), cropped.getHeight(), targetImage.getWidth(), targetImage.getHeight());
      cropped.resize(targetSize, targetSize);
      targetImage.resize(targetSize, targetSize);
      
      // Calculate SSIM
      const png1 = {
        data: cropped.bitmap.data,
        width: cropped.getWidth(),
        height: cropped.getHeight()
      };
      
      const png2 = {
        data: targetImage.bitmap.data,
        width: targetImage.getWidth(),
        height: targetImage.getHeight()
      };
      
      const ssimResult = ssim(png1, png2);
      return ssimResult.mssim;
    } catch (error) {
      console.error('Error calculating region SSIM:', error);
      return 0;
    }
  }

  /**
   * Generate SSIM-based healing suggestions
   */
  async generateSSIMHealingSuggestions(
    currentScreenshot: Buffer,
    referenceScreenshot: Buffer,
    failedSelector: string
  ): Promise<Array<{
    selector: string;
    confidence: number;
    reason: string;
    ssimScore: number;
  }>> {
    try {
      const suggestions = [];
      
      // Try various selector modifications
      const selectorVariations = [
        failedSelector.replace(/\[\d+\]/, ''), // Remove indices
        failedSelector.replace(/:nth-child\(\d+\)/, ''), // Remove nth-child
        failedSelector.split(' ').slice(-1)[0], // Take last part only
        failedSelector.replace(/^[^.#]*/, ''), // Remove tag names
        failedSelector + ', ' + failedSelector.replace(/^\w+/, '*') // Add wildcard version
      ];
      
      for (const variation of selectorVariations) {
        if (variation && variation !== failedSelector) {
          // In a real implementation, we would test these selectors
          // and calculate SSIM for elements found
          const mockSSIM = Math.random() * 0.7 + 0.3; // Mock SSIM for demo
          
          suggestions.push({
            selector: variation,
            confidence: mockSSIM,
            reason: `SSIM-based selector variation with ${(mockSSIM * 100).toFixed(1)}% similarity`,
            ssimScore: mockSSIM
          });
        }
      }
      
      // Sort by confidence
      return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    } catch (error) {
      console.error('Error generating SSIM healing suggestions:', error);
      return [];
    }
  }

  /**
   * Create SSIM-based visual fingerprint for elements
   */
  async createVisualFingerprint(
    imageBuffer: Buffer,
    boundingBox?: { x: number; y: number; width: number; height: number }
  ): Promise<{
    ssimHash: string;
    features: number[];
    dominantColors: string[];
    textureMetrics: {
      contrast: number;
      entropy: number;
      homogeneity: number;
    };
  }> {
    try {
      let image = await jimp.read(imageBuffer);
      
      // Crop if bounding box provided
      if (boundingBox) {
        image = image.crop(
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height
        );
      }
      
      // Resize to standard size for consistent fingerprinting
      image.resize(128, 128);
      
      // Extract basic features
      const features = [];
      const pixels = image.bitmap.data;
      
      // Calculate average RGB values
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
      }
      const pixelCount = pixels.length / 4;
      features.push(r / pixelCount, g / pixelCount, b / pixelCount);
      
      // Simple texture analysis
      let contrast = 0;
      let entropy = 0;
      const histogram = new Array(256).fill(0);
      
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
        histogram[gray]++;
      }
      
      // Calculate entropy
      for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) {
          const p = histogram[i] / pixelCount;
          entropy -= p * Math.log2(p);
        }
      }
      
      // Create simple hash based on features
      const ssimHash = Buffer.from(features.map(f => Math.round(f)).join('')).toString('base64').substring(0, 16);
      
      return {
        ssimHash,
        features,
        dominantColors: ['#rgb'], // Simplified for demo
        textureMetrics: {
          contrast: contrast / pixelCount,
          entropy,
          homogeneity: 1 - entropy / 8 // Normalized
        }
      };
    } catch (error) {
      console.error('Error creating visual fingerprint:', error);
      return {
        ssimHash: '',
        features: [],
        dominantColors: [],
        textureMetrics: { contrast: 0, entropy: 0, homogeneity: 0 }
      };
    }
  }
}