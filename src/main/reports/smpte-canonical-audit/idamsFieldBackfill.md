# IDAMS field backfill — keywords + author bios

> DRY-RUN · 2026-10-07T15:50:38.850Z
> Source: raw `_source/SMPTE/{Journal Article Repository,Conference Repository}` <publication> XML · joined on exact `doi`

## Totals

- <publication> files scanned: 26175; articles with keywords or bios: 2463
- source articles with no registry doc: 908 (the 2016–2023 coverage gap — separate ingest)
- **keywords**: 65 docs to fill (Journal Article 7 · Conference Paper 58) · already had keywords 240 · locked 0 · empty after conform 0
  - term mapping: vocab 10 · fold 1 · typo-fix 3 · normalize 338 · dropped 4
  - terms new to controlledKeywords: **328** (added on --apply)
- **bios**: 469 docs / 1060 bios to fill (Journal Article 445 · Conference Paper 24) · already had bios 810 · locked 0 · no registry authors 5 · no bio matched 0
  - realigned (source paired bio with the wrong author; text match wins): 23
  - docs with ≥1 unmatched source bio: 0 (0 bios)

## Keyword fills

| docId | source terms | → registry keywords |
|---|---|---|
| `10.5594-J07620` | Densitometers · Color densitometry | Densitometers · Color Densitometry |
| `10.5594-j18616` | judder · motion artifacts · frame-rate · subjective study | Judder · Motion Artifacts · Frame-rate |
| `10.5594-j18548` | receivers · television broadcasting | Receivers · Television Broadcasting |
| `10.5594-j18572` | digital audio broadcasting · rendering (computer graphics) · audio signal processing · broadcast channels · interactive systems | Digital Audio Broadcasting · Rendering (Computer Graphics) · Audio Signal Processing · Broadcast Channels · Interactive Systems |
| `10.5594-j18576` | photometry · dimensions · units | Photometry · Dimensions · Units |
| `10.5594-j18577` | cinema · dynamic range · viewer preference | Dynamic Range · Viewer Preference |
| `10.5594-j18635` | information retrieval · speech recognition · content-based retrieval · search engines | Information Retrieval · Speech Recognition · Content-based Retrieval · Search Engines |
| `10.5594-M00123` | Digital TV · Service Information · Electronic Program Guide | Digital TV · Service Information · Electronic Program Guide |
| `10.5594-M001248` | wavelet transform · image sequence coding · multiresolution motion estimation · quantization · bit-rate control | Wavelet Transform · Image Sequence Coding · Multiresolution Motion Estimation · Quantization · Bit-rate Control |
| `10.5594-M00151` | interactive digital video · hyperlinked video · media filtering and adaptation · personalized presentation | Interactive Digital Video · Hyperlinked Video · Media Filtering and Adaptation · Personalized Presentation |
| `10.5594-M001296` | SOA · ESB · EMB · BPM · network production system · TV station total solution | ESB · EMB · BPM · Network Production System · TV Station Total Solution |
| `10.5594-M001333` | Digital Restoration of old films · Intensity Flicker · Regularization | Digital Restoration Of Old Films · Intensity Flicker · Regularization |
| `10.5594-M001400` | Stereoscopic system · 3D lens · 65-mm film · interaxial distance (basis of the shooting) · “Stereo-70” · “Phantom-65” · 3D camera | Stereoscopic System · 3D Lens · 65-mm Film · Interaxial Distance (Basis Of The Shooting) · Stereo-70 · Phantom-65 · 3D Camera |
| `10.5594-M001407` | stereoscopic 3D television · digital video · compression artifacts · network artifacts · subjective testing · active shutter · circularly polarized | Stereoscopic 3D Television · Digital Video · Compression Artifacts · Network Artifacts · Subjective Testing · Active Shutter · Circularly Polarized |
| `10.5594-M001411` | Stereoscopic 3D content generation · post-production · depth editing | Stereoscopic 3D Content Generation · Post-production · Depth Editing |
| `10.5594-M001412` | Blu-ray 3D · Multiview Video Coding · MPEG-4 MVC · Base view · Dependent View · Offset Metadata · BD-Java · BD-J · 3D graphics · 3D Subtitling · Disparity Map | Blu-ray 3D · Multiview Video Coding · MPEG-4 MVC · Base View · Dependent View · Offset Metadata · BD-Java · BD-J · 3D Graphics · 3D Subtitling · Disparity Map |
| `10.5594-M001417` | Mobile3DTV · error resilient transmission · DVB-H | Mobile3DTV · Error Resilient Transmission · DVB-H |
| `10.5594-M001357` | DI · Digital Intermediate · Recorder film · CRTs · LED · Lasers · Spectral Sensitivity · recorders | DI · Digital Intermediate · Recorder Film · CRTs · LED · Lasers · Spectral Sensitivity · Recorders |
| `10.5594-M001358` | Digital preservation · digital restoration · quality measure · quality estimator · quality assessment · audio-visual quality | Digital Preservation · Digital Restoration · Quality Measure · Quality Estimator · Quality Assessment · Audio-visual Quality |
| `10.5594-M001362` | Interactive video · non-linear content · user interaction · object description · personalization · IPTV | Interactive Video · Non-linear Content · User Interaction · Object Description · Personalization · IPTV |
| `10.5594-M001365` | AACS · audio watermark · Cinavia · content protection · embedding · film print mastering · theatrical post-production workflows | AACS · Audio Watermark · Cinavia · Content Protection · Embedding · Film Print Mastering · Theatrical Post-production Workflows |
| `10.5594-M001370` | Fingerprinting · A/V synchronization · Lip sync · Asynchrony · watermark | Fingerprinting · A/V Synchronization · Lip Sync · Asynchrony · Watermark |
| `10.5594-M001372` | BNC · HD-BNC · DIN 1.0/2.3 · Mini BNC · Slimline BNC · Micro BNC | BNC · HD-BNC · DIN 1.0/2.3 · Mini BNC · Slimline BNC · Micro BNC |
| `10.5594-M001373` | “Ultra-low-delay” · “H.264” · “HDTV Codec” · “Wireless Camera” | Ultra-low-delay · H.264 · HDTV Codec · Wireless Camera |
| `10.5594-M001383` | Restoration · Classic film | Restoration · Classic Film |
| `10.5594-M001385` | 3D-TV · 2D-to-3D conversion · 3D cinema | 3D-TV · 2D-to-3D Conversion · 3D Cinema |
| `10.5594-M001387` | Dataflow programming · massively parallel architecture · H.264 codec · low power | Dataflow Programming · Massively Parallel Architecture · H.264 Codec · Low Power |
| `10.5594-M001391` | Migrating from MPEG-2 to MPEG-4 AVC · bandwidth efficiency · DVB-S2 · MPEG-4 AVC · transcoding receiver · transcoder · compression concatenation effects | Migrating From MPEG-2 To MPEG-4 AVC · Bandwidth Efficiency · DVB-S2 · MPEG-4 AVC · Transcoding Receiver · Transcoder · Compression Concatenation Effects |
| `10.5594-M001398` | Uniformity · screen's measurement · vignetting | Uniformity · Screen's Measurement · Vignetting |
| `10.5594-M001077` | 22.2 multichannel sound · HRIR · binaural processing · individual variation · reverberation | 22.2 Multichannel Sound · HRIR · Binaural Processing · Individual Variation · Reverberation |
| `10.5594-M001084` | Mobile TV · Mobile Broadcasting · Multi-screen · Cross-Media · Digital Terrestrial Television · ATSC-MH · DVB-T2 · DMB · ISDB-T · ISDB-Tb · 1-SEG | Mobile TV · Mobile Broadcasting · Multi-screen · Cross-Media · Digital Terrestrial Television · ATSC-MH · DVB-T2 · DMB · ISDB-T · ISDB-Tb · 1-SEG |
| `10.5594-M001093` | Stereo 3D Display · 3D Cinema · Image Scaling · Depth Distortion · Perception Experiments | Stereo 3D Display · 3D Cinema · Image Scaling · Depth Distortion · Perception Experiments |
| `10.5594-M001094` | Active Pulfrich Spectacles · optoelectronics · Pulfrich effect | Active Pulfrich Spectacles · Optoelectronics · Pulfrich Effect |
| `10.5594-M001097` | Compressed Video · Surveillance · Video Masters · Video Archive Library Access · Digital Movie Masters · Video Networking | Compressed Video · Surveillance · Video Masters · Video Archive Library Access · Digital Movie Masters · Video Networking |
| `10.5594-M001099` | DVB-S · DVB-S2 · DVB-T · DVB-T2 · Digital Terrestrial TV · DTTV distribution | DVB-S · DVB-S2 · DVB-T · DVB-T2 · Digital Terrestrial TV · DTTV Distribution |
| `10.5594-M001101` | Millimeter-wave · HDTV Wireless Camera · main link · bi-directional transmission · OFDM · MIMO · STBC | Millimeter-wave · HDTV Wireless Camera · Main Link · Bi-directional Transmission · OFDM · MIMO · STBC |
| `10.5594-M001106` | Control systems · hybrid router · reduce operational costs · streamlining workflow | Control Systems · Hybrid Router · Reduce Operational Costs · Streamlining Workflow |
| `10.5594-M001109` | Statistical Approach · Adaptive Scheduling · QoS · RTCP feedback · User Interactivity | Statistical Approach · Adaptive Scheduling · QoS · RTCP Feedback · User Interactivity |
| `10.5594-M001423` | 3D scanning · Full Body · Camera array · Photometrics · Passive scanning · Sculptural Photography · Free Viewpoint Media | 3D Scanning · Full Body · Camera Array · Photometrics · Passive Scanning · Sculptural Photography · Free Viewpoint Media |
| `10.5594-M001429` | integral imaging · computational reconstruction · parallel-group projection · sub image | Integral Imaging · Computational Reconstruction · Parallel-group Projection · Sub Image |
| `10.5594-M001434` | file-based work flow · video file transmission · transmission priority · TCP · congestion control algorithm | File-based Work Flow · Video File Transmission · Transmission Priority · TCP · Congestion Control Algorithm |
| `10.5594-M001441` | spatial concealment · image restoration · H.264/AVC · intra prediction | Spatial Concealment · Image Restoration · H.264/AVC · Intra Prediction |
| `10.5594-M001442` | file-based system · quality check · converter | File-based System · Quality Check · Converter |
| `10.5594-M001452` | IP Content Networks · Transport · Architectures · Standards & Applications · IP Protecton | IP Content Networks · Transport · Architectures · Standards & Applications · IP Protection |
| `10.5594-M001454` | Stereoscopic 3D (S3D) · Retinex · Structural Similarity Index Measure (SSIM) · Color Matching · Image Enhancement | Stereoscopic 3D (S3D) · Retinex · Structural Similarity Index Measure (SSIM) · Color Matching · Image Enhancement |
| `10.5594-M001457` | Digital Restoration · Motion Picture · Computational Photography | Digital Restoration · Motion Picture · Computational Photography |
| `10.5594-M001458` | Multispectral video · multispectral camera · multispectral display · observer variability · observer metamerism | Multispectral Video · Multispectral Camera · Multispectral Display · Observer Variability · Observer Metamerism |
| `10.5594-M001459` | Color Matching Functions · 1931 CIE Standard Observer | Color Matching Functions · 1931 CIE Standard Observer |
| `10.5594-M001465` | Film postproduction · distant collaboration · video streaming | Film Postproduction · Distant Collaboration · Video Streaming |
| `10.5594-M001476` | digital broadcasts · cable television · time division multiplexing · FTTH | Digital Broadcasts · Cable Television · Time Division Multiplexing · FTTH |
| `10.5594-M001483` | Audio codec evaluation · ITU-R · listening tests · BS.1116 · ciritcal listening setup · subjective testing | Audio Codec Evaluation · ITU-R · Listening Tests · BS.1116 · Critical Listening Setup · Subjective Testing |
| `10.5594-M001485` | sound-on-film · variable density · Lee de Forest · vacuum tube · Audion · arc · selenium cell · Theodore Case · Lauste · Bell · Edison · Fleming · Ruhmer · Vitaphone · Phonofilm · Dickson · Fox · SMPE · Oscar | Sound-on-film · Variable Density · Lee De Forest · Vacuum Tube · Audion · Arc · Selenium Cell · Theodore Case · Lauste · Bell · Edison · Fleming · Ruhmer · Vitaphone · Phonofilm · Dickson · Fox · SMPE · Oscar |
| `10.5594-M001492` | Computational cinematography · depth map · disparity map · hybrid 3D · motion scene camera · multi-camera array · stereo · time-of-flight · tri-focal | Computational Cinematography · Depth Map · Disparity Map · Hybrid 3D · Motion Scene Camera · Multi-camera Array · Stereo · Time-of-flight · Tri-focal |
| `10.5594-M001502` | equalization · room curve · ideal room curve · preferred listening curve · room resonances · neutral transfer function · time-windowed · Fast-Fourier Transform · FFT · spectrum analysis · Real-Time Analysis · RTA · time-windowing · ST 202:2010 · regenerative method · room resonances · room modes · room ring modes · standing waves · flat direct sound response · average response | Equalization · Room Curve · Ideal Room Curve · Preferred Listening Curve · Room Resonances · Neutral Transfer Function · Time-windowed · Fast-Fourier Transform · FFT · Spectrum Analysis · Real-Time Analysis · RTA · Time-windowing · ST 202:2010 · Regenerative Method · Room Modes · Room Ring Modes · Standing Waves · Flat Direct Sound Response · Average Response |
| `10.5594-M001526` | ARIB · standards development organization · radio systems · digital broadcasting · study · R&D · standardization · UHDTV systems · essential industry property rights | ARIB · Standards Development Organization · Radio Systems · Digital Broadcasting · Study · R&D · Standardization · UHDTV Systems · Essential Industry Property Rights |
| `10.5594-M001530` | Codecs · image representation · image manipulation · contourisation · contour images | Codecs · Image Representation · Image Manipulation · Contourisation · Contour Images |
| `10.5594-M001534` | Multi-camera acquisition · free viewpoint · light-field processing · depth-of-field | Multi-camera Acquisition · Free Viewpoint · Light-field Processing · Depth-of-field |
| `10.5594-M001538` | SMPTE ST2022 · Ucompressed Transport · RTP Switching · Centralized management | SMPTE ST2022 · Uncompressed Transport · RTP Switching · Centralized Management |
| `10.5594-M001545` | Immersive Sound · Theater Audio · Evaluation Procedure · Haas Effect · Precedence Effect · Directional Cues · Channel-Based · Object-Based · Wave Field Synthesis (WFS) · High-Order Ambisonics (HOA) | Immersive Sound · Theater Audio · Evaluation Procedure · Haas Effect · Precedence Effect · Directional Cues · Channel-Based · Object-Based · Wave Field Synthesis (WFS) · High-Order Ambisonics (HOA) |
| `10.5594-M001548` | AES-3-4 · AES-2id-2012 · ANSI/SMPTE 276M-1995 · digital audio cable · digital audio transformer · AES/EBU cable · AES-2id · AES3id · 96 kHz sample rate · 192 kHz sample rate | AES-3-4 · AES-2id-2012 · ANSI/SMPTE 276M-1995 · Digital Audio Cable · Digital Audio Transformer · AES/EBU Cable · AES-2id · AES3id · 96 kHz Sample Rate · 192 kHz Sample Rate |
| `10.5594-M001561` | Identity · Identity Domains · Media Identity · Media Identity Domains | Identity · Identity Domains · Media Identity · Media Identity Domains |
| `10.5594-M001568` | Photometry · photometric units · dimensions · tutorial | Photometry · Photometric Units · Dimensions · Tutorial |
| `10.5594-M001587` | Forensic watermarking · piracy · content monitoring · live streaming | Forensic Watermarking · Piracy · Content Monitoring · Streaming |
| `10.5594-M001592` | Remote Monitoring · MPEG Monitor · Confidence Monitoring · iON · Loudness Control | Remote Monitoring · MPEG Monitor · Confidence Monitoring · iON · Loudness Control |
| `10.5594-M001593` | Judder · Motion Artifacts · Frame-Rate · Subjective Study | Judder · Motion Artifacts · Frame-rate |

## New controlledKeywords terms

Review for the long-tail drop/fold list before --apply (keywordVocabDecisions.json `drops` / `folds`).

- 3D Cinema (2)
- Digital Restoration (2)
- Dimensions (2)
- Disparity Map (2)
- DVB-S2 (2)
- DVB-T2 (2)
- Frame-rate (2)
- Judder (2)
- Motion Artifacts (2)
- Photometry (2)
- Subjective Testing (2)
- 1-SEG
- 192 kHz Sample Rate
- 1931 CIE Standard Observer
- 22.2 Multichannel Sound
- 2D-to-3D Conversion
- 3D Camera
- 3D Graphics
- 3D Lens
- 3D Scanning
- 3D Subtitling
- 3D-TV
- 65-mm Film
- 96 kHz Sample Rate
- A/V Synchronization
- AACS
- Active Pulfrich Spectacles
- Active Shutter
- Adaptive Scheduling
- AES-2id
- AES-2id-2012
- AES-3-4
- AES/EBU Cable
- AES3id
- ANSI/SMPTE 276M-1995
- Arc
- Architectures
- ARIB
- Asynchrony
- ATSC-MH
- Audio Codec Evaluation
- Audio Signal Processing
- Audio Watermark
- Audio-visual Quality
- Audion
- Average Response
- Bandwidth Efficiency
- Base View
- BD-J
- BD-Java
- Bell
- Bi-directional Transmission
- Binaural Processing
- Bit-rate Control
- Blu-ray 3D
- BNC
- BPM
- Broadcast Channels
- BS.1116
- Cable Television
- Camera Array
- Centralized Management
- Channel-Based
- Cinavia
- Circularly Polarized
- Classic Film
- Codecs
- Color Densitometry
- Color Matching Functions
- Compressed Video
- Compression Artifacts
- Compression Concatenation Effects
- Computational Cinematography
- Computational Photography
- Computational Reconstruction
- Confidence Monitoring
- Congestion Control Algorithm
- Content Monitoring
- Content Protection
- Content-based Retrieval
- Contour Images
- Contourisation
- Control Systems
- Converter
- Critical Listening Setup
- Cross-Media
- CRTs
- Dataflow Programming
- Densitometers
- Dependent View
- Depth Distortion
- Depth Editing
- Depth Map
- Depth-of-field
- DI
- Dickson
- Digital Audio Broadcasting
- Digital Audio Cable
- Digital Audio Transformer
- Digital Broadcasting
- Digital Broadcasts
- Digital Intermediate
- Digital Movie Masters
- Digital Preservation
- Digital Restoration Of Old Films
- Digital Terrestrial Television
- Digital Terrestrial TV
- Digital TV
- Digital Video
- DIN 1.0/2.3
- Directional Cues
- Distant Collaboration
- DMB
- DTTV Distribution
- DVB-H
- DVB-S
- DVB-T
- Edison
- Electronic Program Guide
- EMB
- Embedding
- Equalization
- Error Resilient Transmission
- ESB
- Essential Industry Property Rights
- Evaluation Procedure
- Fast-Fourier Transform
- FFT
- File-based System
- File-based Work Flow
- Film Postproduction
- Film Print Mastering
- Fingerprinting
- Flat Direct Sound Response
- Fleming
- Forensic Watermarking
- Fox
- Free Viewpoint Media
- FTTH
- Full Body
- H.264 Codec
- H.264/AVC
- Haas Effect
- HD-BNC
- HDTV Codec
- HDTV Wireless Camera
- High-Order Ambisonics (HOA)
- HRIR
- Hybrid 3D
- Hybrid Router
- Hyperlinked Video
- Ideal Room Curve
- Identity
- Identity Domains
- Image Enhancement
- Image Manipulation
- Image Representation
- Image Restoration
- Image Scaling
- Image Sequence Coding
- Immersive Sound
- Individual Variation
- Information Retrieval
- Integral Imaging
- Intensity Flicker
- Interactive Digital Video
- Interactive Systems
- Interaxial Distance (Basis Of The Shooting)
- Intra Prediction
- iON
- IP Content Networks
- IP Protection
- IPTV
- ISDB-T
- ISDB-Tb
- ITU-R
- Lasers
- Lauste
- LED
- Lee De Forest
- Light-field Processing
- Listening Tests
- Loudness Control
- Main Link
- Massively Parallel Architecture
- Media Filtering and Adaptation
- Media Identity
- Media Identity Domains
- Micro BNC
- Migrating From MPEG-2 To MPEG-4 AVC
- Millimeter-wave
- MIMO
- Mini BNC
- Mobile Broadcasting
- Mobile TV
- Mobile3DTV
- Motion Picture
- Motion Scene Camera
- MPEG Monitor
- MPEG-4 AVC
- MPEG-4 MVC
- Multi-camera Acquisition
- Multi-camera Array
- Multi-screen
- Multiresolution Motion Estimation
- Multispectral Camera
- Multispectral Display
- Multispectral Video
- Multiview Video Coding
- Network Artifacts
- Network Production System
- Neutral Transfer Function
- Non-linear Content
- Object Description
- Object-Based
- Observer Variability
- OFDM
- Offset Metadata
- Optoelectronics
- Oscar
- Parallel-group Projection
- Passive Scanning
- Perception Experiments
- Personalization
- Personalized Presentation
- Phantom-65
- Phonofilm
- Photometric Units
- Photometrics
- Piracy
- Post-production
- Precedence Effect
- Preferred Listening Curve
- Pulfrich Effect
- QoS
- Quality Assessment
- Quality Check
- Quality Estimator
- Quality Measure
- Quantization
- R&D
- Radio Systems
- Real-Time Analysis
- Receivers
- Recorder Film
- Recorders
- Reduce Operational Costs
- Regenerative Method
- Regularization
- Remote Monitoring
- Rendering (Computer Graphics)
- Restoration
- Retinex
- Reverberation
- Room Curve
- Room Modes
- Room Resonances
- Room Ring Modes
- RTA
- RTCP Feedback
- RTP Switching
- Ruhmer
- Screen's Measurement
- Sculptural Photography
- Search Engines
- Selenium Cell
- Service Information
- Slimline BNC
- SMPE
- SMPTE ST2022
- Sound-on-film
- Spatial Concealment
- Spectral Sensitivity
- Spectrum Analysis
- Speech Recognition
- ST 202:2010
- Standardization
- Standards & Applications
- Standards Development Organization
- Standing Waves
- Statistical Approach
- STBC
- Stereo 3D Display
- Stereo-70
- Stereoscopic 3D (S3D)
- Stereoscopic 3D Content Generation
- Stereoscopic 3D Television
- Stereoscopic System
- Streamlining Workflow
- Structural Similarity Index Measure (SSIM)
- Study
- Sub Image
- Surveillance
- TCP
- Television Broadcasting
- Theater Audio
- Theatrical Post-production Workflows
- Theodore Case
- Time Division Multiplexing
- Time-of-flight
- Time-windowed
- Time-windowing
- Transcoder
- Transcoding Receiver
- Transmission Priority
- Transport
- Tri-focal
- Tutorial
- TV Station Total Solution
- UHDTV Systems
- Ultra-low-delay
- Uniformity
- Units
- User Interaction
- User Interactivity
- Vacuum Tube
- Variable Density
- Video Archive Library Access
- Video File Transmission
- Video Masters
- Video Networking
- Viewer Preference
- Vignetting
- Vitaphone
- Watermark
- Wave Field Synthesis (WFS)
- Wavelet Transform
- Wireless Camera

## Bio fills (first 40)

| docId | authors | bio filled for |
|---|---|---|
| `10.5594-J11225` | 1 | Lang S. Thompson |
| `10.5594-J07188` | 1 | Rudy Bretz |
| `10.5594-J13580` | 6 | R. Wayne Crew |
| `10.5594-J04243` | 1 | Fay Kanin |
| `10.5594-J04133` | 2 | Laurence J. Roberts |
| `10.5594-J04135` | 1 | Keith Maas |
| `10.5594-J02380` | 1 | Robert J. Zavrel |
| `10.5594-J02384` | 1 | Richard K. Schafer |
| `10.5594-J02167` | 1 | Adam J. Wilt |
| `10.5594-J09653` | 1 | William C. Miller |
| `10.5594-J04606` | 1 | Andrew G. Setos |
| `10.5594-J04607` | 1 | R. Evans Wetmore |
| `10.5594-J04608` | 3 | Julian E. Hansen · Daniel C. Lorti · Roy Thrash |
| `10.5594-J04609` | 2 | Rebecca Redshaw · R. Evans Wetmore |
| `10.5594-J04610` | 1 | David A. Grafton |
| `10.5594-J04611` | 6 | Ray Bouvy · John Vincent · Ken Parulski · Kris Balch · Gary Erickson · Michael Menadier |
| `10.5594-J04612` | 2 | Gerry G. Taylor · Graeme Little |
| `10.5594-J04613` | 2 | Scott E. Hamilton · Jeffrey U. Longbottom |
| `10.5594-J17182` | 1 | David L. George |
| `10.5594-J17183` | 1 | Fung Fai Lam |
| `10.5594-J17184` | 1 | Edgar A. Schuller |
| `10.5594-J17185` | 1 | C. Francis Jenkins |
| `10.5594-J17196` | 1 | Pekka Tarjanne |
| `10.5594-J04552` | 1 | Charlie Bernstein |
| `10.5594-J04553` | 1 | Lionel Hightower |
| `10.5594-J04554` | 5 | H. D. Wactlar · A. G. Hauptmann · M. A. Smith · K. V. Pendyala · D. Garlington |
| `10.5594-J04555` | 1 | John R. Forrest |
| `10.5594-J04556` | 5 | Hajime Sonehara · Yuji Nojiri · Kazuhisa Iguchi · Yukio Sugiura · Hiroshi Hirabayashi |
| `10.5594-J04530` | 3 | John Krooss · Philip Livingston · Stephen Mahrer |
| `10.5594-J04531` | 8 | Samir N. Hulyalkar · Monisha Ghosh · Lee-Fang Wei · David A. Bryan · Carlo Basile · Ahmad K. Aman · Robert L. Cupo · George J. Kustka |
| `10.5594-J04532` | 1 | Gary Sgrignoli |
| `10.5594-J04533` | 4 | I. Sato · K. Hyodo · C. Golson · J. P. Creignou |
| `10.5594-J04534` | 1 | David N. A. Drew |
| `10.5594-J04535` | 1 | C. Bradley Hunt |
| `10.5594-J00564` | 4 | W. E. Glenn · C. E. Holton · G. J. Dixon · P. J. Bos |
| `10.5594-J00565` | 2 | John A. Watlington · V. Michael Bove |
| `10.5594-J00566` | 1 | Hirokazu Yamanoue |
| `10.5594-J00567` | 2 | William Y. Zou · James A. Kutzner |
| `10.5594-J17622` | 1 | Ioan Allen |
| `10.5594-J18210XY` | 1 | Tony Clynick |

## Realigned bios (source paired the bio with a different author — bio text names the registry author)

| docId | source author | → bio lands on |
|---|---|---|
| `10.5594-J04608` | Julian E. Hansen | Daniel C. Lorti |
| `10.5594-J04608` | Daniel C. Lorti | Julian E. Hansen |
| `10.5594-J04309` | X. Lee | G. Hughes |
| `10.5594-J04309` | G. Hughes | X. Lee |
| `10.5594-J05313` | Rabab K. Ward | Panos Nasiopoulos |
| `10.5594-J05313` | Panos Nasiopoulos | Rabab K. Ward |
| `10.5594-J05314` | Mark Horton | Bob Pank |
| `10.5594-J05314` | Bob Pank | Mark Horton |
| `10.5594-J05254` | Simon Waddington | Keith Pickavance |
| `10.5594-J05254` | Keith Pickavance | Simon Waddington |
| `10.5594-J11605` | J. Matey | T. Mattioli |
| `10.5594-J11605` | T. Mattioli | J. Matey |
| `10.5594-j18075` | Phil Tudor | Paul Treleaven |
| `10.5594-j18075` | Paul Treleaven | Phil Tudor |
| `10.5594-j18247XY` | Roger Schwenke | Glenn Leembruggen |
| `10.5594-j18247XY` | Peter Soper | Roger Schwenke |
| `10.5594-j18247XY` | Glenn Leembruggen | Peter Soper |
| `10.5594-j18314` | Eric Rodli | Bill Feightner |
| `10.5594-j18314` | Steve Schklair | Eric Rodli |
| `10.5594-j18468` | Luk Overmeire | Cedric Lejeune |
| `10.5594-j18468` | Erik Mannens | Luk Overmeire |
| `10.5594-j18468` | Cedric Lejeune | Erik Mannens |
| `10.5594-M001465` | Petr Zejdl | Sven Ubik |

## Unmatched source bios (review — never written)

| docId | registry authors | unmatched source author (candidates) |
|---|---|---|
