require_dependency 'upload_creator'

class UploadsController < ApplicationController
  before_filter :ensure_logged_in, except: [:show]
  skip_before_filter :preload_json, :check_xhr, :redirect_to_login_if_required, only: [:show]

  def create
    type = params.require(:type)

    raise Discourse::InvalidAccess.new unless Upload::UPLOAD_TYPES.include?(type)

    if type == "avatar" && (SiteSetting.sso_overrides_avatar || !SiteSetting.allow_uploaded_avatars)
      return render json: failed_json, status: 422
    end

    url  = params[:url]
    file = params[:file] || params[:files]&.first

    if params[:synchronous] && (current_user.staff? || is_api?)
      data = create_upload(file, url, type)
      render json: data.as_json
    else
      Scheduler::Defer.later("Create Upload") do
        begin
          data = create_upload(file, url, type)
        ensure
          MessageBus.publish("/uploads/#{type}", (data || {}).as_json, client_ids: [params[:client_id]])
        end
      end
      render json: success_json
    end
  end

  def show
    return render_404 if !RailsMultisite::ConnectionManagement.has_db?(params[:site])

    RailsMultisite::ConnectionManagement.with_connection(params[:site]) do |db|
      return render_404 unless Discourse.store.internal?
      return render_404 if SiteSetting.prevent_anons_from_downloading_files && current_user.nil?
      return render_404 if SiteSetting.login_required? && db == "default" && current_user.nil?

      if upload = Upload.find_by(sha1: params[:sha]) || Upload.find_by(id: params[:id], url: request.env["PATH_INFO"])
        opts = {
          filename: upload.original_filename,
          content_type: Rack::Mime.mime_type(File.extname(upload.original_filename)),
        }
        opts[:disposition]   = "inline" if params[:inline]
        opts[:disposition] ||= "attachment" unless FileHelper.is_image?(upload.original_filename)
        send_file(Discourse.store.path_for(upload), opts)
      else
        render_404
      end
    end
  end

  protected

  def render_404
    render nothing: true, status: 404
  end

  def create_upload(file, url, type)
    if file.nil?
      if url.present? && is_api?
        maximum_upload_size = [SiteSetting.max_image_size_kb, SiteSetting.max_attachment_size_kb].max.kilobytes
        tempfile = FileHelper.download(url, maximum_upload_size, "discourse-upload-#{type}") rescue nil
        filename = File.basename(URI.parse(url).path)
      end
    else
      tempfile = file.tempfile
      filename = file.original_filename
      content_type = file.content_type
    end

    return { errors: [I18n.t("upload.file_missing")] } if tempfile.nil?

    upload = UploadCreator.new(tempfile, filename, type: type, content_type: content_type).create_for(current_user.id)

    if upload.errors.empty? && current_user.admin?
      retain_hours = params[:retain_hours].to_i
      upload.update_columns(retain_hours: retain_hours) if retain_hours > 0
    end

    upload.errors.empty? ? upload : { errors: upload.errors.values.flatten }
  ensure
    tempfile&.close! rescue nil
  end

end
