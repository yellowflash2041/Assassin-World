class UploadsController < ApplicationController
  before_filter :ensure_logged_in, except: [:show]
  skip_before_filter :preload_json, :check_xhr, only: [:show]

  def create
    type = params.require(:type)
    file = params[:file] || params[:files].first
    url = params[:url]
    client_id = params[:client_id]

    Scheduler::Defer.later("Create Upload") do
      begin
        # API can provide a URL
        if file.nil? && url.present? && is_api?
          tempfile = FileHelper.download(url, SiteSetting.max_image_size_kb.kilobytes, "discourse-upload-#{type}") rescue nil
          filename = File.basename(URI.parse(file).path)
        else
          tempfile = file.tempfile
          filename = file.original_filename
          content_type = file.content_type
        end

        # when we're dealing with an avatar, crop it to its maximum size
        if type == "avatar" && FileHelper.is_image?(filename)
          max = Discourse.avatar_sizes.max
          OptimizedImage.resize(tempfile.path, tempfile.path, max, max, allow_animation: SiteSetting.allow_animated_avatars)
        end

        upload = Upload.create_for(current_user.id, tempfile, filename, tempfile.size, content_type: content_type)

        if upload.errors.empty? && current_user.admin?
          retain_hours = params[:retain_hours].to_i
          upload.update_columns(retain_hours: retain_hours) if retain_hours > 0
        end

        if upload.errors.empty? && FileHelper.is_image?(filename)
          Jobs.enqueue(:create_thumbnails, upload_id: upload.id, type: type, user_id: params[:user_id])
        end

        data = upload.errors.empty? ? upload : { errors: upload.errors.values.flatten }

        MessageBus.publish("/uploads/#{type}", data.as_json, client_ids: [client_id])
      ensure
        tempfile.try(:close!) rescue nil
      end
    end

    # HACK FOR IE9 to prevent the "download dialog"
    response.headers["Content-Type"] = "text/plain" if request.user_agent =~ /MSIE 9/

    render json: success_json
  end

  def show
    return render_404 if !RailsMultisite::ConnectionManagement.has_db?(params[:site])

    RailsMultisite::ConnectionManagement.with_connection(params[:site]) do |db|
      return render_404 unless Discourse.store.internal?
      return render_404 if SiteSetting.prevent_anons_from_downloading_files && current_user.nil?

      if upload = Upload.find_by(sha1: params[:sha]) || Upload.find_by(id: params[:id], url: request.env["PATH_INFO"])
        opts = { filename: upload.original_filename }
        opts[:disposition] = 'inline' if params[:inline]
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

end
