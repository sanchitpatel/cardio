import { assetUrl } from '../utils/assetUrl';

export default function Img({ src, alt = '', ...props }) {
  return <img src={assetUrl(src)} alt={alt} {...props} />;
}
